<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use App\Support\Audit;
use App\Support\Totp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class TwoFactorController extends Controller
{
    // GET /profile/2fa/setup
    public function setup(Request $request)
    {
        $user   = $request->user();
        $secret = Totp::generateSecret();
        $uri    = Totp::getUri($secret, $user->email);

        // Store temp secret in session-like cache until confirmed
        \Illuminate\Support\Facades\Cache::put('2fa_setup:' . $user->id, $secret, now()->addMinutes(10));

        return ApiResponse::ok([
            'secret'  => $secret,
            'uri'     => $uri,
            'enabled' => $user->hasTwoFactorEnabled(),
        ]);
    }

    // POST /profile/2fa/confirm  { code }
    public function confirm(Request $request)
    {
        $request->validate(['code' => ['required', 'string', 'size:6']]);

        $user   = $request->user();
        $secret = \Illuminate\Support\Facades\Cache::pull('2fa_setup:' . $user->id);

        if (! $secret) {
            return ApiResponse::fail('Setup session expired. Start again.', null, 422);
        }

        if (! Totp::verify($secret, $request->input('code'))) {
            return ApiResponse::fail('Invalid code. Check your authenticator app and try again.', null, 422);
        }

        $user->update([
            'two_factor_secret'       => $secret,
            'two_factor_confirmed_at' => now(),
        ]);

        Audit::log('user.2fa_enabled', $user, [], userId: $user->id);

        return ApiResponse::ok(null, 'Two-factor authentication enabled.');
    }

    // DELETE /profile/2fa  { password }
    public function disable(Request $request)
    {
        $request->validate(['password' => ['required', 'string']]);

        $user = $request->user();

        if (! Hash::check($request->input('password'), $user->password)) {
            return ApiResponse::fail('Incorrect password.', null, 422);
        }

        $user->update([
            'two_factor_secret'       => null,
            'two_factor_confirmed_at' => null,
        ]);

        Audit::log('user.2fa_disabled', $user, [], userId: $user->id);

        return ApiResponse::ok(null, 'Two-factor authentication disabled.');
    }
}
