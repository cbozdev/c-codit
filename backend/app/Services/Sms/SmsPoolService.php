<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;
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

    private array $serviceMap = [
        'telegram'  => 'Telegram',
        'facebook'  => 'Facebook',
        'twitter'   => 'Twitter',
        'instagram' => 'Instagram',
        'apple'     => 'Apple',
        'whatsapp'  => 'WhatsApp',
        'google'    => 'Google',
        'microsoft' => 'Microsoft',
        'uber'      => 'Uber',
        'amazon'    => 'Amazon',
        'netflix'   => 'Netflix',
        'hinge'     => 'Hinge',
        'tinder'    => 'Tinder',
        'snapchat'  => 'Snapchat',
        'spotify'   => 'Spotify',
        'paypal'    => 'PayPal',
        'discord'   => 'Discord',
        'viber'     => 'Viber',
        'wechat'    => 'WeChat',
        'bumble'    => 'Bumble',
        'badoo'     => 'Badoo',
        'binance'   => 'Binance',
        'coinbase'  => 'Coinbase',
        'tiktok'    => 'TikTok',
        'linkedin'  => 'LinkedIn',
        'reddit'    => 'Reddit',
    ];

    // ISO code → SMSPool country name (accepted by the /price and /order endpoints)
    private array $countryMap = [
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

    private function key(): string
    {
        return (string) config('services.smspool.api_key');
    }

    private function client()
    {
        return Http::baseUrl($this->baseUrl)
            ->withHeaders(['Accept' => 'application/json'])
            ->timeout(15);
    }

    private function resolveService(string $service): string
    {
        $lower = strtolower(trim($service));
        return $this->serviceMap[$lower] ?? ucfirst($lower);
    }

    private function resolveCountry(string $country): string
    {
        $upper = strtoupper(trim($country));
        return $this->countryMap[$upper] ?? $country;
    }

    public function getPrice(string $service, string $country): ?Money
    {
        try {
            $res = $this->client()->get('/price', [
                'key'     => $this->key(),
                'country' => $this->resolveCountry($country),
                'service' => $this->resolveService($service),
            ]);

            Log::info('smspool.getPrice', [
                'service' => $service,
                'country' => $country,
                'status'  => $res->status(),
                'body'    => substr($res->body(), 0, 200),
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
        return Cache::remember("smspool.country_prices.{$service}", 900, function () use ($service) {
            $serviceName = $this->resolveService($service);
            $baseUrl     = $this->baseUrl;
            $key         = $this->key();

            // Fire one request per popular country concurrently
            $responses = Http::pool(function ($pool) use ($serviceName, $baseUrl, $key) {
                foreach ($this->countryMap as $iso => $countryName) {
                    $pool->as($iso)
                        ->withHeaders(['Accept' => 'application/json'])
                        ->timeout(10)
                        ->get("{$baseUrl}/price", [
                            'key'     => $key,
                            'country' => $countryName,
                            'service' => $serviceName,
                        ]);
                }
            });

            $results  = [];
            $sample   = [];   // log first 3 raw responses for diagnostics
            foreach ($responses as $iso => $res) {
                if ($res instanceof \Throwable) {
                    if (count($sample) < 3) $sample[$iso] = ['error' => $res->getMessage()];
                    continue;
                }
                if (! $res->successful()) {
                    if (count($sample) < 3) $sample[$iso] = ['http' => $res->status(), 'body' => substr($res->body(), 0, 100)];
                    continue;
                }

                $data  = $res->json();
                if (count($sample) < 3) $sample[$iso] = $data;

                if (! is_array($data)) continue;

                $stock = (int) ($data['stock'] ?? 0);
                $price = (float) ($data['price'] ?? 0);
                if ($stock <= 0 || $price <= 0) continue;

                $results[] = [
                    'country_code' => $iso,
                    'count'        => $stock,
                    'price_usd'    => $price,
                ];
            }

            Log::info('smspool.getCountryPrices', [
                'service'     => $service,
                'serviceName' => $serviceName,
                'found'       => count($results),
                'sample'      => $sample,
            ]);

            usort($results, fn ($a, $b) => $a['price_usd'] <=> $b['price_usd']);
            return $results;
        });
    }

    public function purchase(string $service, string $country): array
    {
        $svc = $this->resolveService($service);
        $cty = $this->resolveCountry($country);

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
            throw new ServiceUnavailableException('SMSPool error: '.$msg);
        }

        $body = $res->json();

        if (empty($body['success']) || $body['success'] != 1) {
            $msg = $body['message'] ?? $body['error'] ?? 'Unknown error';
            if (stripos((string) $msg, 'out of stock') !== false || stripos((string) $msg, 'no number') !== false) {
                throw new ServiceUnavailableException('No numbers available for this service/country on SMSPool.');
            }
            throw new ServiceUnavailableException('SMSPool error: '.$msg);
        }

        $orderId = $body['order_id'] ?? null;
        $number  = $body['number']   ?? null;

        if (! $orderId || ! $number) {
            throw new \RuntimeException('SMSPool returned unexpected response: '.json_encode($body));
        }

        $expiresIn = (int) ($body['expires_in'] ?? 1200);

        return [
            'provider_order_id' => (string) $orderId,
            'phone_number'      => '+'.ltrim((string) $number, '+'),
            'expires_at'        => now()->addSeconds($expiresIn)->toISOString(),
            'raw'               => $body,
        ];
    }

    public function cancel(string $providerOrderId): bool
    {
        try {
            $res  = $this->client()->get('/cancel/'.$providerOrderId, ['key' => $this->key()]);
            $body = $res->json();
            return $res->successful() && (($body['success'] ?? 0) == 1);
        } catch (\Throwable) {
            return false;
        }
    }

    public function fetchCode(string $providerOrderId): ?string
    {
        try {
            $res = $this->client()->get('/sms/'.$providerOrderId, ['key' => $this->key()]);
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
