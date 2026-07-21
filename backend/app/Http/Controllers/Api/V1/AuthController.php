<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Mail\WelcomeMail;
use App\Models\User;
use App\Services\Wallet\WalletService;
use App\Support\ApiResponse;
use App\Support\Audit;
use App\Support\Totp;
use App\Support\UserNotify;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly WalletService $wallets) {}

    public function register(RegisterRequest $request)
    {
        $user = DB::transaction(function () use ($request) {
            $referrer = null;
            if ($ref = $request->input('referral_code')) {
                $referrer = User::where('referral_code', strtoupper($ref))->first();
            }
            $u = User::create([
                'name'              => $request->string('name')->toString(),
                'email'             => strtolower($request->string('email')->toString()),
                'password'          => $request->string('password')->toString(),
                'phone'             => $request->input('phone'),
                'country'           => $request->input('country'),
                'terms_accepted_at' => now(),
                'terms_version'     => '1.0',
                'referred_by'       => $referrer?->id,
            ]);
            $u->assignRole('user');
            $this->wallets->getOrCreate($u, 'USD');
            return $u;
        });

        // Fire-and-forget — email delivery must never block or crash registration
        try {
            event(new Registered($user));
        } catch (\Throwable $e) {
            Log::warning('register.verification_email_failed', ['error' => $e->getMessage(), 'user' => $user->id]);
        }

        Audit::log('user.registered', $user, ['email' => $user->email], userId: $user->id);

        try {
            Mail::to($user)->send(new WelcomeMail($user));
        } catch (\Throwable $e) {
            Log::warning('register.welcome_email_failed', ['error' => $e->getMessage(), 'user' => $user->id]);
        }

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
        $email      = strtolower((string) $request->input('email'));
        $ipKey      = 'login:' . $email . ':' . $request->ip();
        $lockoutKey = 'lockout:' . $email;

        // Hard lockout (10 cumulative failures across IPs)
        if (Cache::has($lockoutKey)) {
            $remaining = (int) ceil((Cache::get($lockoutKey . ':exp', now()->timestamp) - now()->timestamp) / 60);
            return ApiResponse::fail("Account temporarily locked. Try again in {$remaining} minute(s).", null, 423);
        }

        // Per-IP rate limit (5 per minute)
        if (RateLimiter::tooManyAttempts($ipKey, 5)) {
            $seconds = RateLimiter::availableIn($ipKey);
            throw ValidationException::withMessages([
                'email' => ["Too many login attempts. Try again in {$seconds} seconds."],
            ]);
        }

        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check((string) $request->input('password'), (string) $user->password)) {
            RateLimiter::hit($ipKey, 60);

            // Track cumulative failures for lockout
            $failures = (int) Cache::increment('login_failures:' . $email);
            Cache::put('login_failures:' . $email, $failures, now()->addMinutes(30));

            if ($failures >= 10) {
                Cache::put($lockoutKey, true, now()->addMinutes(15));
                Cache::put($lockoutKey . ':exp', now()->addMinutes(15)->timestamp, now()->addMinutes(15));
                Cache::forget('login_failures:' . $email);

                // Email user about lockout
                try {
                    if ($user) {
                        Mail::raw(
                            "Hi {$user->name},\n\nYour account has been temporarily locked due to too many failed login attempts. It will unlock in 15 minutes.\n\nIf this wasn't you, please reset your password immediately.\n\nC-codit Security",
                            fn ($m) => $m->to($user->email)->subject('Account temporarily locked — C-codit')
                        );
                        UserNotify::send($user, 'security', 'Account temporarily locked', 'Too many failed login attempts. Locked for 15 minutes.');
                    }
                } catch (\Throwable) {}

                return ApiResponse::fail('Account temporarily locked due to too many failed attempts. Try again in 15 minutes.', null, 423);
            }

            return ApiResponse::fail('Invalid credentials.', ['errors' => ['email' => ['Invalid credentials.']]], 422);
        }

        // Successful auth — clear failure counters
        RateLimiter::clear($ipKey);
        Cache::forget('login_failures:' . $email);

        if ($user->is_suspended) {
            return ApiResponse::fail(
                'Your account has been suspended' . ($user->suspension_reason ? ': ' . $user->suspension_reason : '.'),
                null, 403
            );
        }

        // 2FA check for admins
        if ($user->hasTwoFactorEnabled()) {
            $challenge = (string) Str::uuid();
            Cache::put('2fa_challenge:' . $challenge, $user->id, now()->addMinutes(5));
            return ApiResponse::ok(['requires_2fa' => true, 'challenge' => $challenge], '2FA required.');
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

    public function verifyTwoFactor(Request $request)
    {
        $request->validate([
            'challenge' => ['required', 'string'],
            'code'      => ['required', 'string'],
        ]);

        $userId = Cache::pull('2fa_challenge:' . $request->input('challenge'));
        if (! $userId) {
            return ApiResponse::fail('Challenge expired or invalid. Please log in again.', null, 422);
        }

        $user = User::findOrFail($userId);

        if (! Totp::verify((string) $user->two_factor_secret, (string) $request->input('code'))) {
            return ApiResponse::fail('Invalid authentication code.', null, 422);
        }

        $user->update(['last_login_at' => now()]);

        $token = $user->createToken(
            'web-'.($request->userAgent() ?? 'client'),
            ['*'],
            now()->addMinutes((int) config('sanctum.expiration')),
        )->plainTextToken;

        Audit::log('user.login_2fa', $user, ['ip' => $request->ip()], userId: $user->id);

        return ApiResponse::ok(['user' => new UserResource($user), 'token' => $token], 'Welcome back.');
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
        try {
            Password::sendResetLink(['email' => strtolower((string) $request->input('email'))]);
        } catch (\Throwable $e) {
            Log::error('auth.forgot_password.mail_failed', ['error' => $e->getMessage()]);
        }
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
        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            Log::error('auth.send_verification.mail_failed', ['error' => $e->getMessage()]);
        }
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

    public function deleteAccount(Request $request)
    {
        $request->validate(['password' => ['required', 'string']]);

        $user = $request->user();

        if (! Hash::check($request->input('password'), $user->password)) {
            return ApiResponse::fail('Incorrect password.', null, 422);
        }

        Audit::log('user.account_deleted', $user, ['email' => $user->email], userId: $user->id);

        // Revoke all tokens
        $user->tokens()->delete();

        // Anonymise PII — keep transaction records for financial compliance
        $user->update([
            'name'                    => 'Deleted User',
            'email'                   => 'deleted_' . $user->id . '@c-codit.invalid',
            'phone'                   => null,
            'country'                 => null,
            'google_id'               => null,
            'apple_id'                => null,
            'two_factor_secret'       => null,
            'two_factor_confirmed_at' => null,
            'referral_code'           => null,
        ]);

        // Freeze wallet so balance cannot be touched
        if ($user->wallet) {
            $user->wallet->update(['is_frozen' => true, 'frozen_reason' => 'Account deleted']);
        }

        $user->delete(); // soft delete

        return ApiResponse::ok(null, 'Account deleted. Your financial records are retained for compliance.');
    }

    public function referralInfo(Request $request)
    {
        $user   = $request->user();
        $wallet = $user->wallet;

        // ── Total earned from referral bonuses ─────────────────────────────────
        $totalEarnedMinor = $wallet
            ? \App\Models\Transaction::where('wallet_id', $wallet->id)
                ->where('idempotency_key', 'LIKE', 'referral:%')
                ->where('status', 'success')
                ->sum('amount_minor')
            : 0;

        // ── Categorise referred users ──────────────────────────────────────────
        $referredUsers = User::where('referred_by', $user->id)
            ->select('id', 'name', 'created_at')
            ->orderByDesc('created_at')
            ->get();

        $pending   = [];
        $completed = [];
        $cancelled = [];
        $cutoff    = now()->subDays(45);   // no activity after 45 days → cancelled

        foreach ($referredUsers as $ref) {
            $hasOrder = \App\Models\ServiceOrder::where('user_id', $ref->id)
                ->where('status', 'completed')
                ->exists();

            // Privacy: show first name + masked last initial only
            $parts  = explode(' ', trim($ref->name));
            $masked = $parts[0] . (isset($parts[1]) ? ' ' . strtoupper(mb_substr($parts[1], 0, 1)) . '.' : '');

            $row = [
                'name'      => $masked,
                'joined_at' => $ref->created_at->diffForHumans(),
            ];

            if ($hasOrder) {
                $completed[] = $row;
            } elseif ($ref->created_at->lt($cutoff)) {
                $cancelled[] = $row;
            } else {
                $pending[] = $row;
            }
        }

        // Generate a code on-demand for users created before the referral system existed
        if (! $user->referral_code) {
            $user->referral_code = User::generateReferralCode();
            $user->save();
        }

        $link = rtrim((string) config('app.frontend_url'), '/') . '/register?ref=' . $user->referral_code;

        return ApiResponse::ok([
            'code'             => $user->referral_code,
            'link'             => $link,
            'reward_amount'    => '1.00',
            'min_fund_amount'  => '1.00',
            'total_earned'     => number_format($totalEarnedMinor / 100, 2, '.', ''),
            'total_invitees'   => count($referredUsers),
            'pending'          => $pending,
            'completed'        => $completed,
            'cancelled'        => $cancelled,
        ]);
    }
}
