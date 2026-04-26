<?php

namespace App\Services\Esim;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Airalo eSIM API integration.
 * Docs: https://partners.airalo.com/api-docs
 *
 * Required env vars:
 *   AIRALO_CLIENT_ID=...
 *   AIRALO_CLIENT_SECRET=...
 */
class AiraloService
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.airalo.base_url', 'https://www.airalo.com/api/v2'), '/');
    }

    private function token(): string
    {
        return Cache::remember('airalo.access_token', 3500, function () {
            $res = Http::asForm()->post($this->baseUrl . '/token', [
                'grant_type'    => 'client_credentials',
                'client_id'     => config('services.airalo.client_id'),
                'client_secret' => config('services.airalo.client_secret'),
            ]);

            if ($res->failed()) {
                throw new RuntimeException('Airalo authentication failed. Check AIRALO_CLIENT_ID and AIRALO_CLIENT_SECRET.');
            }

            // Airalo returns token under data.access_token or directly as access_token
            $token = $res->json('data.access_token') ?? $res->json('access_token');
            if (!$token) {
                throw new RuntimeException('Airalo returned no access token.');
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
     * @param  string      $type        'local' | 'global' | 'regional'
     * @param  string|null $countryCode ISO 3166-1 alpha-2 (e.g. 'US', 'GB', 'NG')
     */
    public function getPackages(string $type = 'global', ?string $countryCode = null, int $limit = 30): array
    {
        $params = ['type' => $type, 'limit' => $limit, 'page' => 1, 'include' => 'operators'];
        if ($countryCode) {
            $params['country_code'] = strtoupper($countryCode);
        }

        try {
            $res = $this->client()->get($this->baseUrl . '/packages', $params);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new RuntimeException('Could not connect to eSIM provider. Please try again.');
        }

        if ($res->failed()) {
            Log::channel('payments')->error('airalo.getPackages.failed', [
                'status' => $res->status(),
                'body'   => $res->json(),
                'type'   => $type,
                'country'=> $countryCode,
            ]);
            throw new RuntimeException('Could not fetch eSIM plans.');
        }

        return $res->json('data') ?? [];
    }

    /**
     * Get price (USD) for a specific package.
     */
    public function getPackagePrice(string $packageId): float
    {
        try {
            $res = $this->client()->get($this->baseUrl . '/packages/' . $packageId);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new RuntimeException('Could not verify eSIM plan pricing.');
        }

        if ($res->failed()) {
            throw new RuntimeException('eSIM plan not found or unavailable.');
        }

        $price = $res->json('data.price') ?? $res->json('data.net_price') ?? null;
        if ($price === null) {
            throw new RuntimeException('Could not determine eSIM plan price.');
        }

        return (float) $price;
    }

    /**
     * Purchase an eSIM and return delivery details.
     */
    public function purchase(string $packageId, string $description = 'C-codit eSIM'): array
    {
        try {
            $res = $this->client()->post($this->baseUrl . '/orders', [
                'package_id'  => $packageId,
                'quantity'    => 1,
                'description' => $description,
            ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new RuntimeException('Could not connect to eSIM provider during purchase.');
        }

        Log::channel('payments')->info('airalo.purchase', [
            'package_id' => $packageId,
            'status'     => $res->status(),
        ]);

        if ($res->failed()) {
            $msg = $res->json('message') ?? $res->json('data.message') ?? 'Purchase failed';
            throw new RuntimeException('eSIM purchase failed: ' . $msg);
        }

        $order = $res->json('data');
        $sim   = $order['sims'][0] ?? null;

        if (!$sim) {
            throw new RuntimeException('eSIM order placed but no SIM details returned. Contact support.');
        }

        return [
            'provider_order_id' => (string) ($order['id'] ?? ''),
            'iccid'             => $sim['iccid']            ?? null,
            'activation_code'   => $sim['activation_code'] ?? null,
            'qrcode_url'        => $sim['qrcode_url']       ?? null,
            'direct_apple_url'  => $sim['direct_apple_installation_url'] ?? null,
            'instructions_url'  => $sim['instructions']['installation_url']
                                   ?? 'https://www.airalo.com/how-it-works',
        ];
    }
}
