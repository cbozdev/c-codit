<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Mail\WelcomeMail;
use App\Models\User;
use App\Services\Wallet\WalletService;
use App\Support\ApiResponse;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class SocialAuthController extends Controller
{
    public function __construct(private readonly WalletService $wallets) {}

    /**
     * POST /auth/google  { access_token: string }
     */
    public function google(Request $request)
    {
        $request->validate(['access_token' => ['required', 'string']]);

        try {
            $res = Http::timeout(10)->get('https://www.googleapis.com/oauth2/v1/userinfo', [
                'access_token' => $request->input('access_token'),
            ]);
        } catch (\Throwable $e) {
            Log::warning('social.google.http_error', ['error' => $e->getMessage()]);
            return ApiResponse::fail('Could not verify Google account. Please try again.', null, 503);
        }

        if (!$res->successful()) {
            return ApiResponse::fail('Invalid or expired Google token.', null, 401);
        }

        $info    = $res->json();
        $googleId = $info['id'] ?? null;
        $email   = $info['email'] ?? null;

        if (!$googleId || !$email) {
            return ApiResponse::fail('Incomplete Google profile.', null, 422);
        }

        if (!($info['verified_email'] ?? true)) {
            return ApiResponse::fail('Your Google email address is not verified.', null, 422);
        }

        return $this->loginOrCreate([
            'provider'   => 'google',
            'social_id'  => $googleId,
            'field'      => 'google_id',
            'email'      => strtolower($email),
            'name'       => $info['name'] ?? trim(($info['given_name'] ?? '') . ' ' . ($info['family_name'] ?? '')) ?: 'User',
            'avatar_url' => $info['picture'] ?? null,
        ], $request);
    }

    /**
     * POST /auth/apple  { identity_token: string, name?: string }
     *
     * identity_token is the signed JWT returned by Apple Sign In.
     * name is only sent on the very first Apple sign-in — store it then.
     */
    public function apple(Request $request)
    {
        $request->validate([
            'identity_token' => ['required', 'string'],
            'name'           => ['nullable', 'string', 'max:100'],
        ]);

        try {
            $payload = $this->verifyAppleToken($request->input('identity_token'));
        } catch (\Throwable $e) {
            Log::warning('social.apple.verify_failed', ['error' => $e->getMessage()]);
            return ApiResponse::fail('Invalid or expired Apple token.', null, 401);
        }

        $appleId = $payload['sub'] ?? null;
        $email   = isset($payload['email']) ? strtolower((string) $payload['email']) : null;

        if (!$appleId) {
            return ApiResponse::fail('Could not extract Apple ID from token.', null, 422);
        }

        return $this->loginOrCreate([
            'provider'   => 'apple',
            'social_id'  => $appleId,
            'field'      => 'apple_id',
            'email'      => $email,
            'name'       => $request->input('name') ?: 'Apple User',
            'avatar_url' => null,
        ], $request);
    }

    // ─── Shared login / create ─────────────────────────────────────────────────

    private function loginOrCreate(array $info, Request $request)
    {
        $field  = $info['field'];
        $email  = $info['email'];

        // 1. Find by social ID (returning user)
        $user = User::where($field, $info['social_id'])->first();

        // 2. Find by email and link social ID (same email, different sign-in method)
        if (!$user && $email) {
            $user = User::where('email', $email)->first();
            if ($user) {
                $user->update([$field => $info['social_id']]);
            }
        }

        // 3. Create brand-new user
        if (!$user) {
            if (!$email) {
                return ApiResponse::fail(
                    'No email address was provided. Please sign in with email and password, or use a different social account.',
                    null, 422
                );
            }

            $user = DB::transaction(function () use ($info, $email, $field) {
                $u = User::create([
                    'name'              => $info['name'],
                    'email'             => $email,
                    'password'          => bcrypt(Str::random(32)),
                    $field              => $info['social_id'],
                    'email_verified_at' => now(),
                    'terms_accepted_at' => now(),
                    'terms_version'     => '1.0',
                ]);
                $u->assignRole('user');
                $this->wallets->getOrCreate($u, config('services.platform.base_currency'));
                return $u;
            });

            // Welcome email — fire and forget; don't fail sign-in if this throws
            try {
                Mail::to($user)->send(new WelcomeMail($user));
            } catch (\Throwable $e) {
                Log::warning('social.welcome_email_failed', ['error' => $e->getMessage(), 'user' => $user->id]);
            }

            Audit::log("user.registered.{$info['provider']}", $user, ['email' => $email], userId: $user->id);
        }

        if ($user->is_suspended) {
            return ApiResponse::fail(
                'Your account has been suspended' . ($user->suspension_reason ? ': ' . $user->suspension_reason : '.'),
                null, 403
            );
        }

        $user->update(['last_login_at' => now()]);
        Audit::log("user.{$info['provider']}_login", $user, [], userId: $user->id);

        $token = $user->createToken(
            'web-' . ($request->userAgent() ?? 'client'),
            ['*'],
            now()->addMinutes((int) config('sanctum.expiration')),
        )->plainTextToken;

        return ApiResponse::ok([
            'user'  => new UserResource($user),
            'token' => $token,
        ], 'Welcome!');
    }

    // ─── Apple JWT verification ────────────────────────────────────────────────

    private function verifyAppleToken(string $jwt): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            throw new \RuntimeException('Invalid JWT format.');
        }

        $header  = json_decode(base64_decode(strtr($parts[0], '-_', '+/')), true);
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);

        if (!$header || !$payload) {
            throw new \RuntimeException('Failed to decode JWT segments.');
        }

        if (($payload['exp'] ?? 0) < time()) {
            throw new \RuntimeException('Apple token has expired.');
        }

        if (($payload['iss'] ?? '') !== 'https://appleid.apple.com') {
            throw new \RuntimeException('Invalid token issuer.');
        }

        $clientId = config('services.apple.client_id');
        if ($clientId && ($payload['aud'] ?? '') !== $clientId) {
            throw new \RuntimeException('Token audience does not match Apple client ID.');
        }

        // Fetch Apple public keys (JWKS)
        $jwksRes = Http::timeout(10)->get('https://appleid.apple.com/auth/keys');
        if (!$jwksRes->successful()) {
            throw new \RuntimeException('Could not fetch Apple public keys.');
        }

        $keys = $jwksRes->json('keys') ?? [];
        $kid  = $header['kid'] ?? null;
        $key  = collect($keys)->firstWhere('kid', $kid);

        if (!$key) {
            throw new \RuntimeException("No Apple public key matched kid={$kid}.");
        }

        $pem = $this->rsaJwkToPem($key);

        // Verify RS256 signature
        $signingInput = $parts[0] . '.' . $parts[1];
        $signature    = base64_decode(strtr($parts[2], '-_', '+/'));
        $result       = openssl_verify($signingInput, $signature, $pem, OPENSSL_ALGO_SHA256);

        if ($result !== 1) {
            throw new \RuntimeException('Apple token signature verification failed.');
        }

        return $payload;
    }

    private function rsaJwkToPem(array $jwk): string
    {
        $n = base64_decode(strtr($jwk['n'], '-_', '+/'));
        $e = base64_decode(strtr($jwk['e'], '-_', '+/'));

        // DER-encode RSAPublicKey SEQUENCE { INTEGER modulus, INTEGER exponent }
        $modDer = $this->derInt($n);
        $expDer = $this->derInt($e);
        $rsaSeq = "\x30" . $this->derLen(strlen($modDer . $expDer)) . $modDer . $expDer;

        // AlgorithmIdentifier: OID rsaEncryption + NULL
        $algId = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";

        // BIT STRING wrapping the RSA key (0x00 = no unused bits)
        $bitStr = "\x03" . $this->derLen(strlen($rsaSeq) + 1) . "\x00" . $rsaSeq;

        // SubjectPublicKeyInfo SEQUENCE
        $spki = "\x30" . $this->derLen(strlen($algId . $bitStr)) . $algId . $bitStr;

        return "-----BEGIN PUBLIC KEY-----\n"
            . chunk_split(base64_encode($spki), 64, "\n")
            . "-----END PUBLIC KEY-----\n";
    }

    private function derInt(string $bytes): string
    {
        if (ord($bytes[0]) >= 0x80) {
            $bytes = "\x00" . $bytes;
        }
        return "\x02" . $this->derLen(strlen($bytes)) . $bytes;
    }

    private function derLen(int $len): string
    {
        if ($len < 128) return chr($len);
        $bytes = '';
        while ($len > 0) { $bytes = chr($len & 0xff) . $bytes; $len >>= 8; }
        return chr(0x80 | strlen($bytes)) . $bytes;
    }
}
