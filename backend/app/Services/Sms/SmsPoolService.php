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

    private array $serviceNameMap = [
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

    private array $popularIsoCodes = [
        'US', 'GB', 'RU', 'NG', 'IN', 'ID', 'PH', 'BR', 'MX', 'UA',
        'PK', 'VN', 'KH', 'CN', 'KE', 'GH', 'ZA', 'CA', 'AU', 'DE',
        'FR', 'IT', 'ES', 'PL', 'NL', 'SE', 'TR', 'TH', 'MY', 'SG', 'EG',
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

    private function getServiceList(): array
    {
        return Cache::remember('smspool.service_list', 86400, function () {
            try {
                $res = $this->client()->get('/service', ['key' => $this->key()]);
                $data = $res->successful() ? $res->json() : [];
                Log::info('smspool.service_list', ['count' => count((array) $data), 'sample' => array_slice((array) $data, 0, 3)]);
                return is_array($data) ? $data : [];
            } catch (\Throwable $e) {
                Log::warning('smspool.service_list.error', ['error' => $e->getMessage()]);
                return [];
            }
        });
    }

    private function getCountryList(): array
    {
        return Cache::remember('smspool.country_list', 86400, function () {
            try {
                $res = $this->client()->get('/country', ['key' => $this->key()]);
                $data = $res->successful() ? $res->json() : [];
                Log::info('smspool.country_list', ['count' => count((array) $data), 'sample' => array_slice((array) $data, 0, 3)]);
                return is_array($data) ? $data : [];
            } catch (\Throwable $e) {
                Log::warning('smspool.country_list.error', ['error' => $e->getMessage()]);
                return [];
            }
        });
    }

    private function resolveServiceId(string $service): ?int
    {
        $lower  = strtolower(trim($service));
        $target = strtolower($this->serviceNameMap[$lower] ?? ucfirst($lower));

        foreach ($this->getServiceList() as $svc) {
            $name = strtolower((string) ($svc['name'] ?? ''));
            if ($name === $target) {
                $id = (int) ($svc['ID'] ?? $svc['id'] ?? 0);
                return $id ?: null;
            }
        }

        Log::warning('smspool.resolveServiceId.miss', ['service' => $service, 'target' => $target]);
        return null;
    }

    private function buildIsoToIdMap(): array
    {
        $map = [];
        foreach ($this->getCountryList() as $cty) {
            // SMSPool country objects vary — try common field names
            $code = strtoupper(trim((string) ($cty['code'] ?? $cty['short'] ?? $cty['iso'] ?? '')));
            $id   = (int) ($cty['id'] ?? $cty['ID'] ?? 0);
            if ($code && $id) {
                $map[$code] = $id;
            }
        }
        return $map;
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $serviceId = $this->resolveServiceId($service);
        if (! $serviceId) return null;

        $isoMap    = $this->buildIsoToIdMap();
        $countryId = $isoMap[strtoupper(trim($country))] ?? null;
        if (! $countryId) {
            Log::warning('smspool.getPrice.no_country_id', ['country' => $country]);
            return null;
        }

        try {
            $res = $this->client()->get('/price', [
                'key'     => $this->key(),
                'country' => $countryId,
                'service' => $serviceId,
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
            $serviceId = $this->resolveServiceId($service);
            if (! $serviceId) {
                Log::warning('smspool.getCountryPrices.no_service_id', ['service' => $service]);
                return [];
            }

            $isoMap = $this->buildIsoToIdMap();

            // Build {iso => countryId} map for popular countries only
            $toFetch = [];
            foreach ($this->popularIsoCodes as $iso) {
                if (isset($isoMap[$iso])) {
                    $toFetch[$iso] = $isoMap[$iso];
                }
            }

            if (empty($toFetch)) {
                Log::warning('smspool.getCountryPrices.empty_country_map', ['service' => $service]);
                return [];
            }

            // Concurrent requests via Http::pool
            $baseUrl   = $this->baseUrl;
            $key       = $this->key();
            $isoKeys   = array_keys($toFetch);

            $responses = Http::pool(function ($pool) use ($toFetch, $baseUrl, $key, $serviceId) {
                foreach ($toFetch as $iso => $countryId) {
                    $pool->as($iso)
                        ->withHeaders(['Accept' => 'application/json'])
                        ->timeout(10)
                        ->get("{$baseUrl}/price", [
                            'key'     => $key,
                            'country' => $countryId,
                            'service' => $serviceId,
                        ]);
                }
            });

            $results = [];
            foreach ($responses as $iso => $res) {
                if ($res instanceof \Throwable) continue;
                if (! $res->successful()) continue;

                $data  = $res->json();
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

            Log::info('smspool.getCountryPrices', ['service' => $service, 'serviceId' => $serviceId, 'found' => count($results)]);

            usort($results, fn ($a, $b) => $a['price_usd'] <=> $b['price_usd']);
            return $results;
        });
    }

    public function purchase(string $service, string $country): array
    {
        $serviceId = $this->resolveServiceId($service);
        $isoMap    = $this->buildIsoToIdMap();
        $countryId = $isoMap[strtoupper(trim($country))] ?? null;

        if (! $serviceId || ! $countryId) {
            throw new ServiceUnavailableException(
                "SMSPool: cannot resolve IDs for service={$service} country={$country}."
            );
        }

        Log::info('smspool.purchase.attempt', [
            'service'   => $service,
            'serviceId' => $serviceId,
            'country'   => $country,
            'countryId' => $countryId,
        ]);

        $res = $this->client()->post('/order', [
            'key'     => $this->key(),
            'country' => $countryId,
            'service' => $serviceId,
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
