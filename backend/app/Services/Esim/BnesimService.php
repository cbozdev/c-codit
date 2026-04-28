<?php

namespace App\Services\Esim;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * BNESIM eSIM API integration.
 * Docs: https://bnesim.com/en/esim-api-integration
 *
 * Required env vars:
 *   BNESIM_API_KEY=...
 */
class BnesimService
{
    private string $baseUrl;
    private string $apiKey;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.bnesim.base_url', 'https://api.bnesim.com/v1'), '/');
        $this->apiKey  = (string) config('services.bnesim.api_key');
    }

    private function client()
    {
        return Http::withHeaders([
            'X-API-Key'    => $this->apiKey,
            'Accept'       => 'application/json',
            'Content-Type' => 'application/json',
        ]);
    }

    /**
     * Fetch available packages.
     *
     * @param  string|null $countryCode  ISO 3166-1 alpha-2, or null for all global
     */
    public function getPackages(?string $countryCode = null): array
    {
        $params = ['type' => $countryCode ? 'local' : 'global'];
        if ($countryCode) {
            $params['country'] = strtoupper($countryCode);
        }

        try {
            $res = $this->client()->get($this->baseUrl . '/products', $params);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new RuntimeException('Could not connect to BNESIM. Please try again.');
        }

        if ($res->failed()) {
            Log::channel('payments')->error('bnesim.getPackages.failed', [
                'status'  => $res->status(),
                'body'    => $res->json(),
                'country' => $countryCode,
            ]);
            throw new RuntimeException('Could not fetch BNESIM eSIM plans.');
        }

        return $res->json('data') ?? $res->json('products') ?? [];
    }

    /**
     * Get price (USD) for a specific package.
     */
    public function getPackagePrice(string $packageId): float
    {
        try {
            $res = $this->client()->get($this->baseUrl . '/products/' . $packageId);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new RuntimeException('Could not verify BNESIM plan pricing.');
        }

        if ($res->failed()) {
            throw new RuntimeException('BNESIM: plan not found or unavailable.');
        }

        $price = $res->json('data.price') ?? $res->json('price') ?? null;
        if ($price === null) {
            throw new RuntimeException('Could not determine BNESIM plan price.');
        }

        return (float) $price;
    }

    /**
     * Purchase an eSIM and return delivery details.
     */
    public function purchase(string $packageId, string $description = 'C-codit eSIM'): array
    {
        try {
            $res = $this->client()->post($this->baseUrl . '/esim-orders', [
                'product_id' => $packageId,
                'quantity'   => 1,
                'note'       => $description,
            ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new RuntimeException('Could not connect to BNESIM during purchase.');
        }

        Log::channel('payments')->info('bnesim.purchase', [
            'package_id' => $packageId,
            'status'     => $res->status(),
            'body'       => $res->json(),
        ]);

        if ($res->failed()) {
            $msg = $res->json('message') ?? $res->json('error') ?? 'Purchase failed';
            Log::channel('payments')->error('bnesim.purchase.failed', [
                'status' => $res->status(),
                'body'   => $res->json(),
                'pkg'    => $packageId,
            ]);
            throw new RuntimeException('BNESIM eSIM purchase failed: ' . $msg);
        }

        $order = $res->json('data') ?? $res->json() ?? [];
        $esim  = $order['esim'] ?? $order;

        return [
            'provider_order_id' => (string) ($order['id'] ?? $order['order_id'] ?? uniqid('bne-')),
            'iccid'             => $esim['iccid']              ?? null,
            'activation_code'   => $esim['activation_code']   ?? $esim['lpa'] ?? null,
            'qrcode_url'        => $esim['qr_code_url']        ?? $esim['qrcode'] ?? null,
            'direct_apple_url'  => $esim['apple_url']          ?? null,
            'instructions_url'  => 'https://bnesim.com/en/how-to-install-esim',
        ];
    }
}
