<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsManService implements SmsNumberProvider
{
    public function code(): string { return 'smsman'; }

    private string $baseUrl = 'https://api.sms-man.com/control';

    // SMS-Man application_id map — verify IDs from your SMS-Man dashboard
    private const APP_MAP = [
        'telegram'   => 1,
        'facebook'   => 2,
        'twitter'    => 3,
        'instagram'  => 4,
        'apple'      => 5,
        'whatsapp'   => 6,
        'google'     => 7,
        'microsoft'  => 8,
        'uber'       => 9,
        'amazon'     => 11,
        'netflix'    => 12,
        'hinge'      => 13,
        'tinder'     => 14,
        'snapchat'   => 15,
        'spotify'    => 16,
        'paypal'     => 17,
        'discord'    => 18,
        'viber'      => 19,
        'wechat'     => 20,
        'bumble'     => 21,
        'badoo'      => 22,
        'binance'    => 30,
        'coinbase'   => 35,
    ];

    private function resolveAppId(string $service): ?int
    {
        $s = strtolower(trim($service));
        return self::APP_MAP[$s] ?? (is_numeric($s) ? (int) $s : null);
    }

    private function client()
    {
        return Http::baseUrl($this->baseUrl)
            ->withHeaders(['Accept' => 'application/json'])
            ->timeout(30);
    }

    private function token(): string
    {
        return (string) config('services.smsman.api_key');
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $appId = $this->resolveAppId($service);
        if (!$appId) return null;

        try {
            $res = $this->client()->get('/get-prices', [
                'token'          => $this->token(),
                'application_id' => $appId,
                'country_id'     => $country,
            ]);

            if (!$res->successful()) return null;
            $data = $res->json();
            if (!is_array($data)) return null;

            // Response keyed by country_id → {cost, count}
            $entry = $data[(string) $country] ?? null;
            if (!$entry || (int) ($entry['count'] ?? 0) <= 0) return null;

            $cost = (float) ($entry['cost'] ?? 0);
            if ($cost <= 0) return null;

            return Money::fromDecimal(sprintf('%.4f', $cost), 'USD');
        } catch (\Throwable $e) {
            Log::warning('smsman.getPrice.exception', ['error' => $e->getMessage()]);
            return null;
        }
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->getPrice($service, $country) !== null;
    }

    public function getCountryPrices(string $service): array
    {
        $appId = $this->resolveAppId($service);
        if (!$appId) return [];

        try {
            $res = $this->client()->get('/get-prices', [
                'token'          => $this->token(),
                'application_id' => $appId,
            ]);

            if (!$res->successful()) return [];
            $data = $res->json();
            if (!is_array($data)) return [];
        } catch (\Throwable) {
            return [];
        }

        $results = [];

        foreach ($data as $countryId => $info) {
            $count = (int) ($info['count'] ?? 0);
            $cost  = (float) ($info['cost'] ?? 0);

            if ($count <= 0 || $cost <= 0) continue;

            $results[] = [
                'country_code' => (string) $countryId,
                'count'        => $count,
                'price_usd'    => $cost,
            ];
        }

        usort($results, fn($a, $b) => $a['price_usd'] <=> $b['price_usd']);
        return $results;
    }

    public function purchase(string $service, string $country): array
    {
        $appId = $this->resolveAppId($service);
        if (!$appId) {
            throw new ServiceUnavailableException("Service '{$service}' is not supported on Server 2.");
        }

        Log::info('smsman.purchase.attempt', ['app_id' => $appId, 'country_id' => $country]);

        $res = $this->client()->get('/get-number', [
            'token'          => $this->token(),
            'application_id' => $appId,
            'country_id'     => $country,
        ]);

        Log::info('smsman.purchase.response', [
            'status' => $res->status(),
            'body'   => substr($res->body(), 0, 400),
        ]);

        if (!$res->successful()) {
            $body = $res->json();
            $msg  = $body['error_msg'] ?? $body['error'] ?? $res->body();
            throw new ServiceUnavailableException('SMS-Man error: ' . $msg);
        }

        $body = $res->json();

        if (!empty($body['error_code'])) {
            $msg = $body['error_msg'] ?? 'Unknown error';
            if (str_contains(strtolower((string) $msg), 'no free') || $body['error_code'] == 2) {
                throw new ServiceUnavailableException('No numbers available for this service/country. Try another country.');
            }
            throw new ServiceUnavailableException('SMS-Man error: ' . $msg);
        }

        $requestId = $body['request_id'] ?? null;
        $number    = $body['number'] ?? null;

        if (!$requestId || !$number) {
            throw new \RuntimeException('SMS-Man returned unexpected response: ' . json_encode($body));
        }

        return [
            'provider_order_id' => (string) $requestId,
            'phone_number'      => '+' . ltrim((string) $number, '+'),
            'expires_at'        => null,
            'raw'               => $body,
        ];
    }

    public function cancel(string $providerOrderId): bool
    {
        try {
            $res = $this->client()->get('/set-status', [
                'token'      => $this->token(),
                'request_id' => $providerOrderId,
                'status'     => 'reject',
            ]);
            return $res->successful() && !($res->json()['error_code'] ?? null);
        } catch (\Throwable) {
            return false;
        }
    }

    public function fetchCode(string $providerOrderId): ?string
    {
        try {
            $res = $this->client()->get('/get-sms', [
                'token'      => $this->token(),
                'request_id' => $providerOrderId,
            ]);

            if (!$res->successful()) return null;
            $body = $res->json();

            if (!empty($body['sms_code'])) return (string) $body['sms_code'];

            // Extract code from text if present
            if (!empty($body['sms_text'])) {
                preg_match('/\b(\d{4,8})\b/', (string) $body['sms_text'], $m);
                if (!empty($m[1])) return $m[1];
            }

            return null;
        } catch (\Throwable) {
            return null;
        }
    }
}
