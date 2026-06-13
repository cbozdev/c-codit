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

    private function client()
    {
        return Http::baseUrl($this->baseUrl)
            ->withHeaders([
                'Authorization' => 'Bearer ' . config('services.fivesim.api_key'),
                'Accept'        => 'application/json',
            ])
            ->timeout(30);
    }

    private function rubToUsd(float $rub): float
    {
        return $rub * (float) config('services.platform.rub_usd_rate', 0.011);
    }

    /**
     * Find the cheapest available operator for a product/country combo.
     * Calls GET /v1/guest/prices?country={c}&product={p}
     * Returns ['operator' => string, 'cost' => float] or null.
     */
    private function bestOperator(string $country, string $product): ?array
    {
        try {
            $res = $this->client()->get('/guest/prices', [
                'country' => $country,
                'product' => $product,
            ]);

            if (!$res->successful()) return null;

            $body = $res->json() ?? [];

            // Response: {country: {product: {operator: {cost, count}}}}
            $operators = $body[$country][$product] ?? [];

            $best = null;
            foreach ($operators as $opCode => $info) {
                $count = (int)   ($info['count'] ?? 0);
                $cost  = (float) ($info['cost']  ?? 0);
                if ($count > 0 && $cost > 0) {
                    if ($best === null || $cost < $best['cost']) {
                        $best = ['operator' => $opCode, 'cost' => $cost];
                    }
                }
            }

            return $best;
        } catch (\Throwable) {
            return null;
        }
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $product    = strtolower(trim($service));
        $countryKey = strtolower(trim($country));

        $best = $this->bestOperator($countryKey, $product);
        if (!$best) return null;

        $usd = $this->rubToUsd($best['cost']);
        return Money::fromDecimal(sprintf('%.4f', max($usd, 0.01)), 'USD');
    }

    /**
     * Returns prices for all countries for a product, sorted cheapest first.
     * Calls GET /v1/guest/prices?product={p}
     */
    public function getCountryPrices(string $service): array
    {
        $product = strtolower(trim($service));

        try {
            $res = $this->client()->get('/guest/prices', ['product' => $product]);
            if (!$res->successful()) return [];

            $body = $res->json() ?? [];
            // Response: {country: {product: {operator: {cost, count}}}}
            $results = [];

            foreach ($body as $countryCode => $products) {
                $operators = $products[$product] ?? [];
                $bestCost  = null;
                $totalCount = 0;

                foreach ($operators as $info) {
                    $cnt  = (int)   ($info['count'] ?? 0);
                    $cost = (float) ($info['cost']  ?? 0);
                    if ($cnt > 0 && $cost > 0) {
                        $totalCount += $cnt;
                        if ($bestCost === null || $cost < $bestCost) {
                            $bestCost = $cost;
                        }
                    }
                }

                if ($bestCost && $totalCount > 0) {
                    $results[] = [
                        'country_code' => $countryCode,
                        'country_name' => ucwords(str_replace('_', ' ', $countryCode)),
                        'count'        => $totalCount,
                        'price_usd'    => $this->rubToUsd($bestCost),
                    ];
                }
            }

            usort($results, fn($a, $b) => $a['price_usd'] <=> $b['price_usd']);
            return $results;
        } catch (\Throwable) {
            return [];
        }
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->bestOperator(strtolower(trim($country)), strtolower(trim($service))) !== null;
    }

    /**
     * Purchase an activation number.
     * Calls GET /v1/user/buy/activation/{country}/{operator}/{product}
     */
    public function purchase(string $service, string $country, ?string $areaCode = null): array
    {
        $product    = strtolower(trim($service));
        $countryKey = strtolower(trim($country));

        // Find cheapest available operator
        $best = $this->bestOperator($countryKey, $product);

        if (!$best) {
            throw new ServiceUnavailableException(
                'No numbers available for this service in the selected country. Try a different country.'
            );
        }

        $operator = $best['operator'];
        $endpoint = "/user/buy/activation/{$countryKey}/{$operator}/{$product}";

        Log::info('5sim.purchase.attempt', [
            'product'  => $product,
            'country'  => $countryKey,
            'operator' => $operator,
        ]);

        $res = $this->client()->get($endpoint);

        Log::info('5sim.purchase.response', [
            'status'  => $res->status(),
            'body'    => substr($res->body(), 0, 300),
        ]);

        if ($res->status() === 400) {
            throw new ServiceUnavailableException(
                'No numbers available. Please try a different country.'
            );
        }

        if ($res->status() === 401) {
            Log::error('5sim.purchase.auth_failed');
            throw new RuntimeException('5sim authentication failed — check FIVESIM_API_KEY.');
        }

        if (!$res->successful()) {
            throw new RuntimeException('5sim API error: HTTP ' . $res->status() . ' — ' . substr($res->body(), 0, 200));
        }

        $body = $res->json();

        if (empty($body['id']) || empty($body['phone'])) {
            Log::error('5sim.purchase.bad_response', ['body' => $body]);
            throw new RuntimeException('5sim returned unexpected response: ' . json_encode($body));
        }

        return [
            'provider_order_id' => (string) $body['id'],
            'phone_number'      => '+' . ltrim((string) $body['phone'], '+'),
            'expires_at'        => $body['expires']    ?? null,
            'status'            => $body['status']     ?? null,
            'raw'               => $body,
        ];
    }

    /**
     * Check order status and extract SMS code.
     * Calls GET /v1/user/check/{id}
     */
    public function fetchCode(string $providerOrderId): ?string
    {
        try {
            $res = $this->client()->get("/user/check/{$providerOrderId}");
            if (!$res->successful()) return null;

            $body = (array) $res->json();

            foreach (($body['sms'] ?? []) as $sms) {
                if (!empty($sms['code'])) return (string) $sms['code'];
                if (!empty($sms['text'])) {
                    if (preg_match('/\b(\d{4,8})\b/', (string) $sms['text'], $m)) {
                        return $m[1];
                    }
                }
            }

            return null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Mark order as finished. Calls GET /v1/user/finish/{id}
     */
    public function finish(string $providerOrderId): bool
    {
        try {
            return $this->client()->get("/user/finish/{$providerOrderId}")->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Cancel order and refund. Calls GET /v1/user/cancel/{id}
     */
    public function cancel(string $providerOrderId): bool
    {
        try {
            $res = $this->client()->get("/user/cancel/{$providerOrderId}");
            Log::info('5sim.cancel', ['order_id' => $providerOrderId, 'status' => $res->status()]);
            return $res->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Ban order. Calls GET /v1/user/ban/{id}
     */
    public function ban(string $providerOrderId): bool
    {
        try {
            return $this->client()->get("/user/ban/{$providerOrderId}")->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Get user profile and balance. Calls GET /v1/user/profile
     */
    public function getUserProfile(): ?array
    {
        try {
            $res = $this->client()->get('/user/profile');
            return $res->successful() ? $res->json() : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
