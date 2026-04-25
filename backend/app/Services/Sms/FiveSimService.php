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

    public function getPrice(string $service, string $country): ?Money
    {
        try {
            $res  = $this->client()->get('/guest/prices', [
                'country' => strtolower($country),
                'product' => strtolower($service),
            ]);

            if (! $res->successful()) {
                Log::warning('5sim.getPrice.failed', ['status' => $res->status(), 'body' => $res->body()]);
                return null;
            }

            $body = $res->json();

            $priceRub = null;
            $countryKey = strtolower($country);
            $serviceKey = strtolower($service);

            foreach (($body[$countryKey][$serviceKey] ?? []) as $operator => $info) {
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
            Log::warning('5sim.getPrice.exception', ['error' => $e->getMessage()]);
            return null;
        }
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->getPrice($service, $country) !== null;
    }

    public function purchase(string $service, string $country): array
    {
        $countryLower = strtolower($country);
        $serviceLower = strtolower($service);

        Log::info('5sim.purchase.attempt', ['service' => $serviceLower, 'country' => $countryLower]);

        $res = $this->client()->get("/user/buy/activation/{$countryLower}/any/{$serviceLower}");

        Log::info('5sim.purchase.response', [
            'status' => $res->status(),
            'body'   => substr($res->body(), 0, 500),
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

            // Check sms array
            foreach (($body['sms'] ?? []) as $sms) {
                if (! empty($sms['code'])) return (string) $sms['code'];
                // Some services put the code in 'text' field
                if (! empty($sms['text'])) {
                    // Try to extract numeric code from text
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
