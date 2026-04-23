<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Wallet\WalletService;
use App\Support\ApiResponse;
use App\Support\Audit;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly WalletService $wallets) {}

    public function register(RegisterRequest $request)
    {
        $user = DB::transaction(function () use ($request) {
            $u = User::create([
                'name'              => $request->string('name')->toString(),
                'email'             => strtolower($request->string('email')->toString()),
                'password'          => $request->string('password')->toString(),
                'phone'             => $request->input('phone'),
                'country'           => $request->input('country'),
                'terms_accepted_at' => now(),
                'terms_version'     => '1.0',
            ]);
            $u->assignRole('user');
            $this->wallets->getOrCreate($u, config('services.platform.base_currency'));
            return $u;
        });

        event(new Registered($user));
        Audit::log('user.registered', $user, ['email' => $user->email], userId: $user->id);

        $token = $user->createToken(
            'web-'.($request->userAgent() ?? 'client'),
            ['*'],
            now()->addMinutes((int) config('sanctum.expiration')),
        )->plainTextToken;

        return ApiResponse::ok([
            'user'  => new UserResource($user),
            'token' => $token,
        ], 'Account created. Check your email to verify.', 201);
    }

    public function login(LoginRequest $request)
    {
        $key = 'login:'.strtolower((string) $request->input('email')).':'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);
            return ApiResponse::fail("Too many login attempts. Try again in {$seconds}s.", null, 429);
        }

        $user = User::where('email', strtolower((string) $request->input('email')))->first();

        if (! $user || ! Hash::check((string) $request->input('password'), $user->password)) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
        }
        if ($user->is_suspended) {
            return ApiResponse::fail('Your account is suspended.', ['reason' => $user->suspension_reason], 403);
        }
        if (! $user->is_active) {
            return ApiResponse::fail('Your account is inactive.', null, 403);
        }

        RateLimiter::clear($key);

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        $deviceName = (string) ($request->input('device_name') ?: $request->userAgent() ?: 'unknown');
        $token = $user->createToken(
            'auth:'.substr($deviceName, 0, 50),
            ['*'],
            now()->addMinutes((int) config('sanctum.expiration')),
        )->plainTextToken;

        Audit::log('user.login', $user, ['ip' => $request->ip()], userId: $user->id);

        return ApiResponse::ok([
            'user'  => new UserResource($user),
            'token' => $token,
        ], 'Logged in.');
    }

    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();
        Audit::log('user.logout');
        return ApiResponse::ok(null, 'Logged out.');
    }

    public function logoutAll(Request $request)
    {
        $request->user()?->tokens()->delete();
        Audit::log('user.logout_all');
        return ApiResponse::ok(null, 'All sessions revoked.');
    }

    public function me(Request $request)
    {
        return ApiResponse::ok(new UserResource($request->user()));
    }

    public function sendVerificationEmail(Request $request)
    {
        $user = $request->user();
        if ($user->hasVerifiedEmail()) {
            return ApiResponse::ok(null, 'Email already verified.');
        }
        $user->sendEmailVerificationNotification();
        return ApiResponse::ok(null, 'Verification email sent.');
    }

    public function verifyEmail(Request $request, int $id, string $hash)
    {
        $user = User::findOrFail($id);
        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return ApiResponse::fail('Invalid verification link.', null, 403);
        }
        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            Audit::log('user.email_verified', $user, [], userId: $user->id);
        }
        return ApiResponse::ok(null, 'Email verified.');
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);
        $status = Password::sendResetLink(['email' => strtolower((string) $request->input('email'))]);
        // Always return success to prevent user enumeration.
        return ApiResponse::ok(null, 'If the email exists, a reset link was sent.');
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'email'                 => ['required', 'email'],
            'token'                 => ['required', 'string'],
            'password'              => ['required', 'confirmed', 'min:10'],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                $user->tokens()->delete();
            },
        );

        return $status === Password::PASSWORD_RESET
            ? ApiResponse::ok(null, 'Password reset.')
            : ApiResponse::fail('Could not reset password.', null, 422);
    }
}
