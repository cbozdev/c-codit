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
            throw ValidationException::withMessages([
                'email' => ["Too many login attempts. Please try again in {$seconds} seconds."],
            ]);
        }

        $user = User::where('email', strtolower((string) $request->input('email')))->first();

        if (! $user || ! Hash::check((string) $request->input('password'), (string) $user->password)) {
            RateLimiter::hit($key, 60);
            return ApiResponse::fail('Invalid credentials.', [
                'errors' => ['email' => ['Invalid credentials.']],
            ], 422);
        }

        RateLimiter::clear($key);

        if ($user->is_suspended) {
            return ApiResponse::fail(
                'Your account has been suspended' . ($user->suspension_reason ? ': ' . $user->suspension_reason : '.'),
                null, 403
            );
        }

        $user->update(['last_login_at' => now()]);

        $token = $user->createToken(
            'web-'.($request->userAgent() ?? 'client'),
            ['*'],
            now()->addMinutes((int) config('sanctum.expiration')),
        )->plainTextToken;

        Audit::log('user.login', $user, ['ip' => $request->ip()], userId: $user->id);

        return ApiResponse::ok([
            'user'  => new UserResource($user),
            'token' => $token,
        ], 'Welcome back.');
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return ApiResponse::ok(null, 'Logged out.');
    }

    public function logoutAll(Request $request)
    {
        $request->user()->tokens()->delete();
        return ApiResponse::ok(null, 'All sessions revoked.');
    }

    public function me(Request $request)
    {
        return ApiResponse::ok(new UserResource($request->user()->load('wallet')));
    }

    public function updateProfile(Request $request)
    {
        $request->validate([
            'name'    => ['sometimes', 'string', 'min:2', 'max:100'],
            'phone'   => ['sometimes', 'nullable', 'string', 'max:20'],
            'country' => ['sometimes', 'nullable', 'string', 'max:60'],
        ]);

        $user = $request->user();
        $user->update($request->only(['name', 'phone', 'country']));

        Audit::log('user.profile_updated', $user, $request->only(['name', 'phone', 'country']), userId: $user->id);

        return ApiResponse::ok(new UserResource($user), 'Profile updated.');
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => ['required', 'confirmed', 'min:10'],
        ]);

        if (! Hash::check($request->input('current_password'), $request->user()->password)) {
            return ApiResponse::fail('Current password is incorrect.', null, 422);
        }

        $request->user()->update(['password' => $request->input('password')]);
        $request->user()->tokens()->where('id', '!=', $request->user()->currentAccessToken()->id)->delete();

        Audit::log('user.password_changed', $request->user(), [], userId: $request->user()->id);
        return ApiResponse::ok(null, 'Password changed successfully.');
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink(['email' => strtolower((string) $request->input('email'))]);
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
            : ApiResponse::fail('Could not reset password. The link may have expired.', null, 422);
    }

    public function sendVerificationEmail(Request $request)
    {
        $user = $request->user();
        if ($user->email_verified_at) {
            return ApiResponse::ok(null, 'Email already verified.');
        }
        $user->sendEmailVerificationNotification();
        return ApiResponse::ok(null, 'Verification email sent.');
    }

    public function verifyEmail(Request $request, string $id, string $hash)
    {
        $user = User::findOrFail($id);
        if (! hash_equals(sha1($user->email), $hash)) {
            return ApiResponse::fail('Invalid verification link.', null, 403);
        }
        $user->markEmailAsVerified();
        return ApiResponse::ok(null, 'Email verified.');
    }
}
