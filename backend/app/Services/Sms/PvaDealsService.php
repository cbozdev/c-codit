<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * PVADeals virtual number integration (USA + UK, STR + LTR).
 * Docs: https://prod-v3.pvadeals.com/v3/api
 *
 * Key facts from the API:
 *  - /services/all returns entries per-country (each service has a 'country' field).
 *    UK Facebook and US Facebook are separate catalog entries with different _ids.
 *  - /purchase takes {services:[{serviceId}]} — country is implicit in the serviceId.
 *  - /purchase-ltr with serviceId=ALL_SERVICES takes an optional 'country' param:
 *    US → 28 days at $12.99 | GB → 30 days at $9.99
 *
 * Required env vars:
 *   PVADEALS_API_KEY=API-xxxxx...
 */
class PvaDealsService implements SmsNumberProvider
{
    public function code(): string { return 'pvadeals'; }

    private string $baseUrl = 'https://prod-v3.pvadeals.com/v3/api';

    private function key(): string
    {
        return (string) config('services.pvadeals.api_key');
    }

    private function client()
    {
        return Http::baseUrl($this->baseUrl)
            ->withHeaders([
                'Authorization' => 'Bearer ' . $this->key(),
                'Accept'        => 'application/json',
            ])
            ->timeout(20);
    }

    /**
     * Normalize a country string to 'US' or 'GB'.
     * Returns null for unsupported countries.
     */
    private function normalizeCountry(string $country): ?string
    {
        $c = strtolower(trim($country));
        if (in_array($c, ['us', 'usa', 'united states', 'united states of america'], true)) return 'US';
        if (in_array($c, ['uk', 'gb', 'england', 'united kingdom', 'great britain'],   true)) return 'GB';
        return null;
    }

    /**
     * Normalize the 'country' field from the catalog response to 'US' or 'GB'.
     */
    private function catalogCountryCode(string $country): string
    {
        $c = strtolower(trim($country));
        if (in_array($c, ['gb', 'uk', 'england', 'united kingdom', 'great britain'], true)) return 'GB';
        return 'US';
    }

    /**
     * Fetch and cache the full service catalog.
     *
     * Returns: [ $slugName => [ 'US' => [...], 'GB' => [...] ], ... ]
     * Each country entry holds the service _id and prices for that country.
     */
    private function getCatalog(): array
    {
        // v2 key invalidates the old flat-structure cache
        $cached = Cache::get('pvadeals.catalog.v2');
        if (is_array($cached) && count($cached) > 0) {
            return $cached;
        }

        try {
            $res = $this->client()->get('/services/all');
            if (! $res->successful()) {
                Log::warning('pvadeals.catalog.failed', ['status' => $res->status(), 'body' => substr($res->body(), 0, 200)]);
                return [];
            }

            $services = $res->json('data.services') ?? [];
            $index    = [];

            foreach ($services as $svc) {
                $name = strtolower(trim((string) ($svc['name'] ?? '')));
                if (! $name || ! isset($svc['_id'])) continue;

                $cc = $this->catalogCountryCode((string) ($svc['country'] ?? 'USA'));

                $index[$name][$cc] = [
                    'id'        => (string) $svc['_id'],
                    'name'      => (string) $svc['name'],
                    'price'     => (float) ($svc['STRprice']  ?? 0),
                    'ltr3'      => (float) ($svc['LTR3price'] ?? 0),
                    'ltr7'      => (float) ($svc['LTR7price'] ?? 0),
                    'ltr14'     => (float) ($svc['LTR14price'] ?? 0),
                    'ltr30'     => (float) ($svc['LTR30price'] ?? 0),
                    'str_stock' => (int)   ($svc['STRstock']  ?? 0),
                    'ltr_stock' => (int)   ($svc['LTRstock']  ?? 0),
                    'image_url' => (string) ($svc['picture']  ?? ''),
                ];
            }

            if (count($index) > 0) {
                Cache::put('pvadeals.catalog.v2', $index, 600);
                Log::info('pvadeals.catalog.loaded', ['count' => count($index)]);
            }

            return $index;
        } catch (\Throwable $e) {
            Log::warning('pvadeals.catalog.exception', ['error' => $e->getMessage()]);
            return [];
        }
    }

    /**
     * Find a service entry for a specific country code ('US' or 'GB').
     */
    private function findService(string $service, string $cc = 'US'): ?array
    {
        $catalog = $this->getCatalog();
        $key     = strtolower(trim($service));

        if (isset($catalog[$key][$cc])) return $catalog[$key][$cc];

        foreach ($catalog as $name => $countries) {
            if (str_contains($name, $key) || str_contains($key, $name)) {
                if (isset($countries[$cc])) return $countries[$cc];
            }
        }

        return null;
    }

    /** Returns catalog as a flat array for the frontend with STR + LTR prices for both countries. */
    public function getPublicCatalog(): array
    {
        $catalog = $this->getCatalog();
        if (empty($catalog)) return [];

        $svc    = \App\Models\Service::where('provider', 'pvadeals')->where('category', 'virtual_number')->first();
        $markup = $svc ? ((float) ($svc->markup_percent ?? 15)) : 15;
        $m      = 1 + $markup / 100;

        $items = [];
        foreach ($catalog as $slug => $countries) {
            $usInfo = $countries['US'] ?? null;
            $gbInfo = $countries['GB'] ?? null;

            if (! $usInfo && ! $gbInfo) continue;

            $info = $usInfo ?? $gbInfo;

            $ltrPrices   = [];
            $ukLtrPrices = [];
            foreach ([3, 7, 14, 30] as $days) {
                if ($usInfo && $usInfo['ltr' . $days] > 0) {
                    $ltrPrices[$days] = round($usInfo['ltr' . $days] * $m, 4);
                }
                if ($gbInfo && $gbInfo['ltr' . $days] > 0) {
                    $ukLtrPrices[$days] = round($gbInfo['ltr' . $days] * $m, 4);
                }
            }

            $items[] = [
                'slug'          => $slug,
                'name'          => $info['name'],
                'price_usd'     => $usInfo && $usInfo['price'] > 0 ? round($usInfo['price'] * $m, 4) : null,
                'uk_price_usd'  => $gbInfo && $gbInfo['price'] > 0 ? round($gbInfo['price'] * $m, 4) : null,
                'ltr_prices'    => $ltrPrices,
                'uk_ltr_prices' => $ukLtrPrices,
                'image_url'     => $info['image_url'] ?? '',
            ];
        }

        usort($items, fn ($a, $b) => strcmp($a['name'], $b['name']));
        return $items;
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $cc = $this->normalizeCountry($country);
        if (! $cc) return null;

        $svc = $this->findService($service, $cc);
        if (! $svc || $svc['price'] <= 0) return null;

        return Money::fromDecimal(sprintf('%.4f', $svc['price']), 'USD');
    }

    public function getLtrPrice(string $service, int $duration, string $country = 'US'): ?Money
    {
        $cc = $this->normalizeCountry($country) ?? 'US';

        // ALL_SERVICES fixed pricing
        if ($duration === 28) return Money::fromDecimal('12.99', 'USD'); // US All-Services

        $svc = $this->findService($service, $cc);
        if (! $svc) return null;

        $price = $svc['ltr' . $duration] ?? 0;
        return $price > 0 ? Money::fromDecimal(sprintf('%.4f', $price), 'USD') : null;
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->getPrice($service, $country) !== null;
    }

    public function getCountryPrices(string $service): array
    {
        $catalog = $this->getCatalog();
        $key     = strtolower(trim($service));

        $results  = [];
        $slugs    = isset($catalog[$key]) ? [$key => $catalog[$key]] : [];

        // Fuzzy match if exact not found
        if (empty($slugs)) {
            foreach ($catalog as $name => $countries) {
                if (str_contains($name, $key) || str_contains($key, $name)) {
                    $slugs[$name] = $countries;
                    break;
                }
            }
        }

        foreach ($slugs as $countries) {
            foreach ($countries as $cc => $info) {
                if ($info['price'] > 0) {
                    $results[] = [
                        'country_code' => $cc === 'GB' ? 'GB' : 'US',
                        'count'        => $info['str_stock'] ?: 1,
                        'price_usd'    => $info['price'],
                    ];
                }
            }
        }

        return $results;
    }

    public function purchase(string $service, string $country, ?string $areaCode = null): array
    {
        $cc = $this->normalizeCountry($country);
        if (! $cc) {
            throw new ServiceUnavailableException('PVADeals only provides US and UK numbers.');
        }

        // Use the country-specific service ID — country is implicit in the serviceId
        $svc = $this->findService($service, $cc);
        if (! $svc) {
            throw new ServiceUnavailableException('Service not available in ' . $cc . ' from PVADeals. Please try a different provider.');
        }

        if ($svc['price'] <= 0) {
            throw new ServiceUnavailableException('This service is not currently available in ' . $cc . '.');
        }

        Log::info('pvadeals.purchase.attempt', [
            'service'    => $svc['name'],
            'service_id' => $svc['id'],
            'country'    => $cc,
        ]);

        $serviceEntry = ['serviceId' => $svc['id']];
        if ($areaCode) $serviceEntry['areaCode'] = $areaCode;

        $res = $this->client()->asJson()->post('/purchase', [
            'services' => [$serviceEntry],
        ]);

        Log::info('pvadeals.purchase.response', [
            'status' => $res->status(),
            'body'   => substr($res->body(), 0, 400),
        ]);

        if (! $res->successful() || empty($res->json('success'))) {
            throw new ServiceUnavailableException('No numbers are available for this service. Please try again later.');
        }

        $request = $res->json('data.requests.0') ?? null;
        if (! $request || empty($request['_id']) || empty($request['number'])) {
            throw new \RuntimeException('PVADeals returned unexpected response: ' . substr($res->body(), 0, 200));
        }

        return [
            'provider_order_id' => (string) $request['_id'],
            'phone_number'      => '+' . ltrim((string) $request['number'], '+'),
            'expires_at'        => $request['endTime'] ?? now()->addMinutes(20)->toISOString(),
            'allow_flag'        => (bool) ($request['allowFlag'] ?? true),
            'allow_reuse'       => (bool) ($request['allowReuse'] ?? false),
            'raw'               => $request,
        ];
    }

    /**
     * Purchase a long-term rental number.
     *
     * For ALL_SERVICES ($duration===28 for US, or pass $country='GB' for the 30-day UK number):
     *   - US:  serviceId=ALL_SERVICES, country=US  → 28 days, $12.99
     *   - GB:  serviceId=ALL_SERVICES, country=GB  → 30 days, $9.99
     */
    public function purchaseLtr(string $service, int $duration, ?string $areaCode = null, string $country = 'US'): array
    {
        $cc = $this->normalizeCountry($country) ?? 'US';

        $isAllServices = ($duration === 28)
            || in_array(strtolower(trim($service)), ['all_services', 'all services', 'all'], true);

        if ($isAllServices) {
            $payload = ['serviceId' => 'ALL_SERVICES', 'country' => $cc];
            // duration is set by country server-side, but must match if sent
            if ($cc === 'GB') {
                $payload['duration'] = 30;
            }
        } else {
            $svc = $this->findService($service, $cc);
            if (! $svc) {
                throw new ServiceUnavailableException('Service not available on PVADeals.');
            }
            $payload = ['duration' => $duration, 'serviceId' => $svc['id']];
            if ($areaCode) $payload['areaCode'] = $areaCode;
        }

        Log::info('pvadeals.ltr.purchase.attempt', [
            'service'  => $service,
            'duration' => $duration,
            'country'  => $cc,
            'payload'  => $payload,
        ]);

        $res = $this->client()->asJson()->post('/purchase-ltr', $payload);

        Log::info('pvadeals.ltr.purchase.response', [
            'status'  => $res->status(),
            'body'    => $res->body(),
            'payload' => $payload,
        ]);

        if (! $res->successful() || empty($res->json('success'))) {
            throw new ServiceUnavailableException(
                $res->json('message') ?? 'No LTR numbers available. Please try again later.'
            );
        }

        // PvaDeals may return data directly or nested under 'data'
        $raw  = $res->json();
        $data = $raw['data'] ?? $raw;

        // Some responses nest the item under 'requests[0]'
        if (isset($data['requests'][0])) {
            $data = $data['requests'][0];
        }

        // PvaDeals uses '_id' (MongoDB) in most endpoints but 'requestId' in webhooks
        $orderId = $data['_id'] ?? $data['requestId'] ?? $data['id'] ?? null;
        $phone   = $data['number'] ?? $data['phoneNumber'] ?? $data['phone'] ?? null;

        if (! $orderId || ! $phone) {
            Log::error('pvadeals.ltr.unexpected_response', [
                'body'    => $res->body(),
                'orderId' => $orderId,
                'phone'   => $phone,
            ]);
            throw new ServiceUnavailableException('Number provisioning failed. Please try again.');
        }

        $actualDuration = $isAllServices ? ($cc === 'GB' ? 30 : 28) : $duration;

        return [
            'provider_order_id' => (string) $orderId,
            'phone_number'      => '+' . ltrim((string) $phone, '+'),
            'expires_at'        => $data['endTime'] ?? $data['expiresAt'] ?? now()->addDays($actualDuration)->toISOString(),
            'auto_renew_enable' => (bool) ($data['autoRenewEnable'] ?? $data['auto_renew'] ?? false),
            'allow_flag'        => (bool) ($data['allowFlag'] ?? true),
            'allow_reuse'       => false,
            'number_type'       => 'LTR',
            'duration'          => $actualDuration,
            'raw'               => $data,
        ];
    }

    public function reuse(string $providerOrderId): array
    {
        $res  = $this->client()->post("/reuse/{$providerOrderId}");
        $body = $res->json();

        if (! $res->successful() || empty($body['success'])) {
            throw new ServiceUnavailableException($body['message'] ?? 'Reuse not available for this number.');
        }

        $data = $body['data'] ?? [];
        return [
            'provider_order_id' => (string) ($data['_id'] ?? $providerOrderId),
            'phone_number'      => '+' . ltrim((string) ($data['number'] ?? ''), '+'),
            'expires_at'        => $data['endTime'] ?? null,
            'allow_reuse'       => (bool) ($data['allowReuse'] ?? false),
            'reuse_counter'     => (int)  ($data['reuseCounter'] ?? 0),
        ];
    }

    public function toggleAutoRenew(string $providerOrderId): array
    {
        $res  = $this->client()->post("/renew-ltr/{$providerOrderId}");
        $body = $res->json();

        if (! $res->successful() || empty($body['success'])) {
            throw new ServiceUnavailableException($body['message'] ?? 'Could not toggle auto-renew.');
        }

        $data = $body['data'] ?? [];
        return [
            'auto_renew_enable' => (bool) ($data['autoRenewEnable'] ?? false),
            'expires_at'        => $data['endTime'] ?? null,
        ];
    }

    public function cancel(string $providerOrderId): bool
    {
        try {
            $res  = $this->client()->post("/flag/{$providerOrderId}");
            $body = $res->json();
            return $res->successful() && ! empty($body['success']);
        } catch (\Throwable) {
            return false;
        }
    }

    public function fetchCode(string $providerOrderId): ?string
    {
        try {
            $res = $this->client()->get("/request/{$providerOrderId}");
            if (! $res->successful()) return null;

            $data    = $res->json('data') ?? [];
            $message = (string) ($data['message'] ?? $data['sms'] ?? $data['code'] ?? '');

            if ($message) {
                preg_match('/\b(\d{4,8})\b/', $message, $m);
                if (! empty($m[1])) return $m[1];
            }

            return null;
        } catch (\Throwable) {
            return null;
        }
    }
}
