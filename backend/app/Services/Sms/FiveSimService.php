<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class FiveSimService implements SmsNumberProvider
{
    public function code(): string { return '5sim'; }

    private string $baseUrl = 'https://5sim.net/v1';

    // 5sim uses its own country slug conventions — map our frontend values to theirs
    private const COUNTRY_MAP = [
        'uk'           => 'england',
        'southafrica'  => 'southafrica',
        'usa'          => 'usa',
        'uae'          => 'uae',
    ];

    // Product aliases — 5sim slugs sometimes differ from common names
    private const PRODUCT_MAP = [
        'any' => null, // 5sim has no "any" product; caught below with a clear error
    ];

    private function normalizeCountry(string $country): string
    {
        $c = strtolower(trim($country));
        return self::COUNTRY_MAP[$c] ?? $c;
    }

    private function normalizeProduct(string $service): string|null
    {
        $s = strtolower(trim($service));
        // Returns null if product has no 5sim equivalent
        return array_key_exists($s, self::PRODUCT_MAP) ? self::PRODUCT_MAP[$s] : $s;
    }

    private function client()
    {
        return Http::baseUrl($this->baseUrl)
            ->withHeaders([
                'Authorization' => 'Bearer ' . config('services.fivesim.api_key'),
                'Accept'        => 'application/json',
            ])
            ->timeout(30);
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $product    = $this->normalizeProduct($service);
        $countryKey = $this->normalizeCountry($country);

        if ($product === null) {
            Log::warning('5sim.getPrice.unsupported_product', ['service' => $service]);
            return null;
        }

        try {
            $res = $this->client()->get('/guest/prices', [
                'country' => $countryKey,
                'product' => $product,
            ]);

            if (! $res->successful()) {
                Log::warning('5sim.getPrice.failed', [
                    'status'  => $res->status(),
                    'body'    => $res->body(),
                    'product' => $product,
                    'country' => $countryKey,
                    'raw_service' => $service,
                    'raw_country' => $country,
                ]);
                return null;
            }

            $body = $res->json();

            $priceRub = null;
            foreach (($body[$countryKey][$product] ?? []) as $operator => $info) {
                if (($info['count'] ?? 0) > 0) {
                    $priceRub = (float) ($info['cost'] ?? 0);
                    break;
                }
            }

            if ($priceRub === null || $priceRub <= 0) return null;

            $rate = (float) config('services.platform.rub_usd_rate', 0.011);
            $usd  = $priceRub * $rate;

            return Money::fromDecimal(sprintf('%.4f', max($usd, 0.01)), 'USD');
        } catch (\Throwable $e) {
            Log::warning('5sim.getPrice.exception', [
                'error'   => $e->getMessage(),
                'product' => $product,
                'country' => $countryKey,
            ]);
            return null;
        }
    }

    /**
     * Returns prices for all available countries for a given service, sorted cheapest first.
     * Uses 5sim's bulk endpoint GET /guest/prices?product={x}
     */
    public function getCountryPrices(string $service): array
    {
        $product = $this->normalizeProduct($service);
        if (!$product) return [];

        try {
            $res = $this->client()->get('/guest/prices', ['product' => $product]);
            if (!$res->successful()) return [];
            $data = $res->json() ?? [];
        } catch (\Throwable) {
            return [];
        }

        $rubRate = (float) config('services.platform.rub_usd_rate', 0.011);
        $results = [];

        foreach ($data as $country => $products) {
            $operators = $products[$product] ?? [];
            $bestCost  = null;
            $totalCount = 0;

            foreach ($operators as $opInfo) {
                $cnt = (int) ($opInfo['count'] ?? 0);
                $cost = (float) ($opInfo['cost'] ?? 0);
                if ($cnt > 0 && $cost > 0) {
                    $totalCount += $cnt;
                    if ($bestCost === null || $cost < $bestCost) $bestCost = $cost;
                }
            }

            if (!$bestCost || $totalCount <= 0) continue;

            $results[] = [
                'country_code' => $country,
                'count'        => $totalCount,
                'price_usd'    => $bestCost * $rubRate,
            ];
        }

        usort($results, fn($a, $b) => $a['price_usd'] <=> $b['price_usd']);
        return $results;
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->getPrice($service, $country) !== null;
    }

    public function purchase(string $service, string $country): array
    {
        $product    = $this->normalizeProduct($service);
        $countryKey = $this->normalizeCountry($country);

        if ($product === null) {
            throw new ServiceUnavailableException('Please select a specific service — "Any" is not supported.');
        }

        Log::info('5sim.purchase.attempt', ['product' => $product, 'country' => $countryKey]);

        $res = $this->client()->get("/user/buy/activation/{$countryKey}/any/{$product}");

        Log::info('5sim.purchase.response', [
            'status'  => $res->status(),
            'body'    => substr($res->body(), 0, 500),
            'product' => $product,
            'country' => $countryKey,
        ]);

        if ($res->status() === 400) {
            $body = $res->json();
            $msg  = $body['message'] ?? $res->body();
            if (str_contains((string) $msg, 'no free phones') || str_contains((string) $msg, 'no free')) {
                throw new ServiceUnavailableException('No phone numbers available for this service/country. Try a different country.');
            }
            throw new ServiceUnavailableException('5sim error: ' . $msg);
        }

        if ($res->status() === 401) {
            throw new RuntimeException('5sim authentication failed. Please check your API key in Render environment variables.');
        }

        if (! $res->successful()) {
            throw new RuntimeException('5sim API error: HTTP ' . $res->status() . ' — ' . substr($res->body(), 0, 200));
        }

        $body = $res->json();

        if (empty($body['id']) || empty($body['phone'])) {
            throw new RuntimeException('5sim returned unexpected response: ' . json_encode($body));
        }

        return [
            'provider_order_id' => (string) $body['id'],
            'phone_number'      => '+' . ltrim((string) $body['phone'], '+'),
            'expires_at'        => $body['expires'] ?? null,
            'raw'               => $body,
        ];
    }

    public function cancel(string $providerOrderId): bool
    {
        try {
            $res = $this->client()->get("/user/cancel/{$providerOrderId}");
            return $res->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    public function fetchCode(string $providerOrderId): ?string
    {
        try {
            $res = $this->client()->get("/user/check/{$providerOrderId}");
            if (! $res->successful()) return null;

            $body = (array) $res->json();

            foreach (($body['sms'] ?? []) as $sms) {
                if (! empty($sms['code'])) return (string) $sms['code'];
                if (! empty($sms['text'])) {
                    preg_match('/\b(\d{4,8})\b/', (string) $sms['text'], $m);
                    if (! empty($m[1])) return $m[1];
                }
            }

            return null;
        } catch (\Throwable) {
            return null;
        }
    }
}
