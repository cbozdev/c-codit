<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SMSPool virtual number integration.
 * Docs: https://www.smspool.net/page/api
 *
 * Required env vars:
 *   SMSPOOL_API_KEY=...
 */
class SmsPoolService implements SmsNumberProvider
{
    public function code(): string { return 'smspool'; }

    private string $baseUrl = 'https://www.smspool.net/api';

    private function key(): string
    {
        return (string) config('services.smspool.api_key');
    }

    private function client()
    {
        return Http::baseUrl($this->baseUrl)
            ->withHeaders(['Accept' => 'application/json'])
            ->timeout(30);
    }

    /**
     * SMSPool accepts service names like "telegram", "facebook", etc.
     * Map our internal service names to SMSPool service names.
     */
    private function resolveService(string $service): string
    {
        $map = [
            'telegram'   => 'Telegram',
            'facebook'   => 'Facebook',
            'twitter'    => 'Twitter',
            'instagram'  => 'Instagram',
            'apple'      => 'Apple',
            'whatsapp'   => 'WhatsApp',
            'google'     => 'Google',
            'microsoft'  => 'Microsoft',
            'uber'       => 'Uber',
            'amazon'     => 'Amazon',
            'netflix'    => 'Netflix',
            'hinge'      => 'Hinge',
            'tinder'     => 'Tinder',
            'snapchat'   => 'Snapchat',
            'spotify'    => 'Spotify',
            'paypal'     => 'PayPal',
            'discord'    => 'Discord',
            'viber'      => 'Viber',
            'wechat'     => 'WeChat',
            'bumble'     => 'Bumble',
            'badoo'      => 'Badoo',
            'binance'    => 'Binance',
            'coinbase'   => 'Coinbase',
            'tiktok'     => 'TikTok',
            'linkedin'   => 'LinkedIn',
            'reddit'     => 'Reddit',
        ];
        $lower = strtolower(trim($service));
        return $map[$lower] ?? ucfirst($lower);
    }

    /**
     * SMSPool uses country names or numeric IDs.
     * We accept ISO-2 codes and map to country names for common ones.
     */
    private function resolveCountry(string $country): string
    {
        $map = [
            'US' => 'United States',
            'GB' => 'United Kingdom',
            'UK' => 'United Kingdom',
            'RU' => 'Russia',
            'NG' => 'Nigeria',
            'IN' => 'India',
            'ID' => 'Indonesia',
            'PH' => 'Philippines',
            'BR' => 'Brazil',
            'MX' => 'Mexico',
            'UA' => 'Ukraine',
            'PK' => 'Pakistan',
            'KH' => 'Cambodia',
            'VN' => 'Vietnam',
            'CN' => 'China',
            'KE' => 'Kenya',
            'GH' => 'Ghana',
            'ZA' => 'South Africa',
            'CA' => 'Canada',
            'AU' => 'Australia',
            'DE' => 'Germany',
            'FR' => 'France',
            'IT' => 'Italy',
            'ES' => 'Spain',
            'PL' => 'Poland',
            'NL' => 'Netherlands',
            'SE' => 'Sweden',
            'TR' => 'Turkey',
            'TH' => 'Thailand',
            'MY' => 'Malaysia',
            'SG' => 'Singapore',
            'EG' => 'Egypt',
            'ET' => 'Ethiopia',
        ];
        $upper = strtoupper(trim($country));
        return $map[$upper] ?? $country;
    }

    public function getPrice(string $service, string $country): ?Money
    {
        try {
            $res = $this->client()->get('/price', [
                'key'     => $this->key(),
                'country' => $this->resolveCountry($country),
                'service' => $this->resolveService($service),
            ]);

            if (! $res->successful()) return null;

            $data = $res->json();
            if (! is_array($data)) return null;

            $stock = (int) ($data['stock'] ?? 0);
            $price = (float) ($data['price'] ?? 0);

            if ($stock <= 0 || $price <= 0) return null;

            return Money::fromDecimal(sprintf('%.4f', $price), 'USD');
        } catch (\Throwable $e) {
            Log::warning('smspool.getPrice.exception', ['error' => $e->getMessage()]);
            return null;
        }
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->getPrice($service, $country) !== null;
    }

    public function getCountryPrices(string $service): array
    {
        try {
            $res = $this->client()->get('/price', [
                'key'     => $this->key(),
                'service' => $this->resolveService($service),
            ]);

            if (! $res->successful()) return [];
            $data = $res->json();
            if (! is_array($data)) return [];
        } catch (\Throwable) {
            return [];
        }

        $results = [];
        foreach ($data as $entry) {
            if (! is_array($entry)) continue;
            $stock = (int) ($entry['stock'] ?? 0);
            $price = (float) ($entry['price'] ?? 0);
            if ($stock <= 0 || $price <= 0) continue;
            $results[] = [
                'country_code' => $entry['country'] ?? $entry['country_code'] ?? '',
                'count'        => $stock,
                'price_usd'    => $price,
            ];
        }
        usort($results, fn($a, $b) => $a['price_usd'] <=> $b['price_usd']);
        return $results;
    }

    public function purchase(string $service, string $country): array
    {
        $svc     = $this->resolveService($service);
        $cty     = $this->resolveCountry($country);

        Log::info('smspool.purchase.attempt', ['service' => $svc, 'country' => $cty]);

        $res = $this->client()->post('/order', [
            'key'     => $this->key(),
            'country' => $cty,
            'service' => $svc,
            'pool'    => 0,
        ]);

        Log::info('smspool.purchase.response', [
            'status' => $res->status(),
            'body'   => substr($res->body(), 0, 400),
        ]);

        if (! $res->successful()) {
            $msg = $res->json('message') ?? $res->json('error') ?? $res->body();
            throw new ServiceUnavailableException('SMSPool error: ' . $msg);
        }

        $body = $res->json();

        if (empty($body['success']) || $body['success'] != 1) {
            $msg = $body['message'] ?? $body['error'] ?? 'Unknown error';
            if (stripos((string) $msg, 'out of stock') !== false || stripos((string) $msg, 'no number') !== false) {
                throw new ServiceUnavailableException('No numbers available for this service/country on SMSPool.');
            }
            throw new ServiceUnavailableException('SMSPool error: ' . $msg);
        }

        $orderId = $body['order_id'] ?? null;
        $number  = $body['number']   ?? null;

        if (! $orderId || ! $number) {
            throw new \RuntimeException('SMSPool returned unexpected response: ' . json_encode($body));
        }

        $expiresIn = (int) ($body['expires_in'] ?? 1200);

        return [
            'provider_order_id' => (string) $orderId,
            'phone_number'      => '+' . ltrim((string) $number, '+'),
            'expires_at'        => now()->addSeconds($expiresIn)->toISOString(),
            'raw'               => $body,
        ];
    }

    public function cancel(string $providerOrderId): bool
    {
        try {
            $res = $this->client()->get('/cancel/' . $providerOrderId, [
                'key' => $this->key(),
            ]);
            $body = $res->json();
            return $res->successful() && (($body['success'] ?? 0) == 1);
        } catch (\Throwable) {
            return false;
        }
    }

    public function fetchCode(string $providerOrderId): ?string
    {
        try {
            $res = $this->client()->get('/sms/' . $providerOrderId, [
                'key' => $this->key(),
            ]);

            if (! $res->successful()) return null;
            $body = $res->json();

            if (! empty($body['sms'])) return (string) $body['sms'];

            if (! empty($body['full_sms'])) {
                preg_match('/\b(\d{4,8})\b/', (string) $body['full_sms'], $m);
                if (! empty($m[1])) return $m[1];
            }

            return null;
        } catch (\Throwable) {
            return null;
        }
    }
}
