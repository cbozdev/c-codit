<?php

namespace App\Services\Esim;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Celitech eSIM API integration.
 * Docs: https://www.celitech.com/developers
 *
 * Required env vars:
 *   CELITECH_CLIENT_ID=...
 *   CELITECH_CLIENT_SECRET=...
 */
class CelitechService
{
    private string $baseUrl  = 'https://api.celitech.net/v1';
    private string $authUrl  = 'https://auth.celitech.net/oauth2/token';

    private function token(): string
    {
        return Cache::remember('celitech.access_token', 3500, function () {
            $res = Http::asForm()->post($this->authUrl, [
                'grant_type'    => 'client_credentials',
                'client_id'     => config('services.celitech.client_id'),
                'client_secret' => config('services.celitech.client_secret'),
            ]);

            if ($res->failed()) {
                throw new RuntimeException('Celitech authentication failed. Check CELITECH_CLIENT_ID and CELITECH_CLIENT_SECRET.');
            }

            $token = $res->json('access_token');
            if (! $token) {
                throw new RuntimeException('Celitech returned no access token.');
            }
            return $token;
        });
    }

    private function client()
    {
        return Http::withToken($this->token())->acceptJson();
    }

    /**
     * Fetch available packages.
     *
     * @param  string|null $destination  ISO 3166-1 alpha-2 country code, or null for global
     */
    public function getPackages(?string $destination = null): array
    {
        $params = [];
        if ($destination) {
            $params['destination'] = strtoupper($destination);
        }

        try {
            $res = $this->client()->get($this->baseUrl . '/packages', $params);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new RuntimeException('Could not connect to Celitech. Please try again.');
        }

        if ($res->failed()) {
            Log::channel('payments')->error('celitech.getPackages.failed', [
                'status'      => $res->status(),
                'body'        => $res->json(),
                'destination' => $destination,
            ]);
            throw new RuntimeException('Could not fetch Celitech eSIM plans.');
        }

        return $res->json('packages') ?? $res->json('data') ?? [];
    }

    /**
     * Get price (USD) for a specific package ID.
     */
    public function getPackagePrice(string $packageId): float
    {
        $packages = $this->getPackages();
        foreach ($packages as $pkg) {
            if (($pkg['id'] ?? '') === $packageId) {
                return (float) ($pkg['price'] ?? $pkg['retailPrice'] ?? 0);
            }
        }
        throw new RuntimeException('Celitech: package not found or unavailable.');
    }

    /**
     * Purchase an eSIM and return delivery details.
     */
    public function purchase(string $packageId, string $description = 'C-codit eSIM'): array
    {
        try {
            $res = $this->client()->post($this->baseUrl . '/esim', [
                'packageId' => $packageId,
                'quantity'  => 1,
            ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new RuntimeException('Could not connect to Celitech during purchase.');
        }

        Log::channel('payments')->info('celitech.purchase', [
            'package_id' => $packageId,
            'status'     => $res->status(),
        ]);

        if ($res->failed()) {
            $msg = $res->json('message') ?? $res->json('error') ?? 'Purchase failed';
            Log::channel('payments')->error('celitech.purchase.failed', [
                'status' => $res->status(),
                'body'   => $res->json(),
                'pkg'    => $packageId,
            ]);
            throw new RuntimeException('Celitech eSIM purchase failed: ' . $msg);
        }

        $esim = $res->json('esim') ?? $res->json('data') ?? [];

        if (empty($esim)) {
            throw new RuntimeException('Celitech order placed but no eSIM details returned. Contact support.');
        }

        return [
            'provider_order_id' => (string) ($esim['iccid'] ?? uniqid('cel-')),
            'iccid'             => $esim['iccid']             ?? null,
            'activation_code'   => $esim['activationCode']   ?? null,
            'qrcode_url'        => $esim['qrCodeUrl']         ?? null,
            'direct_apple_url'  => $esim['appleInstallationUrl'] ?? null,
            'instructions_url'  => 'https://www.celitech.com/how-to-install',
        ];
    }
}
