<?php

namespace App\Services\GiftCard;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Reloadly Gift Card API integration.
 *
 * Docs: https://developers.reloadly.com/gifts/
 * Auth: client_credentials OAuth2
 * Audience differs between sandbox and production.
 */
class ReloadlyService
{
    private string $authUrl   = 'https://auth.reloadly.com/oauth/token';
    private string $apiBase;
    private string $audience;

    public function __construct()
    {
        $sandbox        = (bool) config('services.reloadly.sandbox', false);
        $this->apiBase  = $sandbox
            ? 'https://giftcards-sandbox.reloadly.com'
            : 'https://giftcards.reloadly.com';
        $this->audience = $this->apiBase;
    }

    // ─── Token ───────────────────────────────────────────────────────────────

    private function token(): string
    {
        $cacheKey = 'reloadly_gc_token';
        if ($cached = Cache::get($cacheKey)) {
            return $cached;
        }

        $clientId     = config('services.reloadly.client_id');
        $clientSecret = config('services.reloadly.client_secret');

        if (empty($clientId) || empty($clientSecret)) {
            throw new RuntimeException('Reloadly credentials not configured (RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET).');
        }

        $res = Http::timeout(15)->post($this->authUrl, [
            'client_id'     => $clientId,
            'client_secret' => $clientSecret,
            'grant_type'    => 'client_credentials',
            'audience'      => $this->audience,
        ]);

        if (! $res->successful()) {
            Log::error('reloadly.auth.failed', ['status' => $res->status(), 'body' => $res->body()]);
            throw new RuntimeException('Failed to authenticate with Reloadly. Please try again later.');
        }

        $data  = $res->json();
        $token = $data['access_token'] ?? null;
        $ttl   = max(60, (int) ($data['expires_in'] ?? 3600) - 120); // cache with 2-min buffer

        if (! $token) {
            throw new RuntimeException('Reloadly returned an invalid auth response.');
        }

        Cache::put($cacheKey, $token, $ttl);
        return $token;
    }

    private function get(string $path, array $query = []): array
    {
        $res = Http::withToken($this->token())
            ->withHeaders(['Accept' => 'application/com.reloadly.giftcards-v1+json'])
            ->timeout(15)
            ->get($this->apiBase . $path, $query);

        if (! $res->successful()) {
            Log::error('reloadly.api.error', ['path' => $path, 'status' => $res->status(), 'body' => $res->body()]);
            throw new RuntimeException('Reloadly API error: ' . ($res->json('message') ?? $res->status()));
        }

        return $res->json();
    }

    private function post(string $path, array $body): array
    {
        $res = Http::withToken($this->token())
            ->withHeaders(['Accept' => 'application/com.reloadly.giftcards-v1+json'])
            ->timeout(20)
            ->post($this->apiBase . $path, $body);

        if (! $res->successful()) {
            Log::error('reloadly.api.error', ['path' => $path, 'status' => $res->status(), 'body' => $res->body()]);
            throw new RuntimeException('Reloadly API error: ' . ($res->json('message') ?? $res->status()));
        }

        return $res->json();
    }

    // ─── Products ─────────────────────────────────────────────────────────────

    /**
     * List available gift card products.
     * Returns popular brands for the given country.
     */
    public function getProducts(string $countryCode = 'US', int $size = 100, int $page = 0): array
    {
        $data = $this->get('/products', [
            'countryCode'  => strtoupper($countryCode),
            'size'         => $size,
            'page'         => $page,
            'includeRange' => 'true',
            'includeFixed' => 'true',
        ]);

        $items = $data['content'] ?? $data;

        return array_map(fn($p) => $this->formatProduct($p), (array) $items);
    }

    /**
     * Get a single product with full denomination details.
     */
    public function getProduct(int $productId): array
    {
        $p = $this->get("/products/{$productId}");
        return $this->formatProduct($p);
    }

    // ─── Orders ───────────────────────────────────────────────────────────────

    /**
     * Place a gift card order.
     *
     * @param  int    $productId        Reloadly product ID
     * @param  float  $unitPrice        Denomination in sender currency (USD)
     * @param  string $recipientEmail   Email to receive the gift card code
     * @param  string $customIdentifier Unique order reference (our order public_id)
     * @return array  {transaction_id, pin, serial, info, validity, expiry}
     */
    public function placeOrder(
        int    $productId,
        float  $unitPrice,
        string $recipientEmail,
        string $customIdentifier,
        string $senderName = 'C-codit',
    ): array {
        $result = $this->post('/orders', [
            'productId'        => $productId,
            'quantity'         => 1,
            'unitPrice'        => $unitPrice,
            'customIdentifier' => $customIdentifier,
            'senderName'       => $senderName,
            'recipientEmail'   => $recipientEmail,
        ]);

        $pin    = $result['pinDetail']  ?? [];
        $txId   = $result['transactionId'] ?? null;
        $product = $result['product']   ?? [];

        Log::info('reloadly.order.placed', [
            'transaction_id'   => $txId,
            'product_id'       => $productId,
            'amount'           => $unitPrice,
            'custom_identifier'=> $customIdentifier,
        ]);

        return [
            'transaction_id' => (string) ($txId ?? ''),
            'product_name'   => $product['productName'] ?? '',
            'pin'            => $pin['pin']     ?? $pin['number'] ?? null,
            'serial'         => $pin['serial']  ?? null,
            'info'           => $pin['info']    ?? null,
            'validity'       => $pin['validity'] ?? $pin['validityDate'] ?? null,
            'expiry_date'    => $pin['expiryDate'] ?? null,
            'code'           => $pin['code']    ?? null,
            'redemption_url' => $product['redeemInstruction']['verbose'] ?? null,
            'raw'            => $result,
        ];
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function formatProduct(array $p): array
    {
        $fixed = $p['fixedRecipientDenominations'] ?? [];
        sort($fixed);

        return [
            'product_id'     => $p['productId'],
            'name'           => $p['productName'],
            'brand'          => $p['brand']['brandName'] ?? $p['productName'],
            'country_code'   => $p['country']['isoName'] ?? ($p['countryCode'] ?? ''),
            'currency'       => $p['recipientCurrencyCode'] ?? 'USD',
            'logo_url'       => $p['logoUrls'][0] ?? null,
            'denomination_type' => strtolower($p['denominationType'] ?? 'fixed'),
            'fixed_denominations' => $fixed,
            'min_amount'     => (float) ($p['minSenderDenomination'] ?? $p['minRecipientDenomination'] ?? 0),
            'max_amount'     => (float) ($p['maxSenderDenomination'] ?? $p['maxRecipientDenomination'] ?? 0),
            'sender_fee'     => (float) ($p['senderFee'] ?? 0),
            'sender_fee_pct' => (float) ($p['senderFeePercentage'] ?? 0),
            'category'       => $p['category']['name'] ?? '',
        ];
    }
}
