<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * PVADeals virtual number integration (USA only, STR + LTR).
 * Docs: https://docs.pvadeals.com
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
     * Fetch and cache the full service catalog.
     * Returns array keyed by lowercase service name.
     */
    private function getCatalog(): array
    {
        $cached = Cache::get('pvadeals.catalog');
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
            $index = [];
            foreach ($services as $svc) {
                $name = strtolower(trim((string) ($svc['name'] ?? '')));
                if ($name && isset($svc['_id'])) {
                    $index[$name] = [
                        'id'        => (string) $svc['_id'],
                        'name'      => (string) $svc['name'],
                        'price'     => (float) ($svc['STRprice'] ?? 0),
                        'ltr3'      => (float) ($svc['LTR3price'] ?? 0),
                        'ltr7'      => (float) ($svc['LTR7price'] ?? 0),
                        'ltr14'     => (float) ($svc['LTR14price'] ?? 0),
                        'ltr30'     => (float) ($svc['LTR30price'] ?? 0),
                        'image_url' => (string) ($svc['picture'] ?? ''),
                    ];
                }
            }

            if (count($index) > 0) {
                Cache::put('pvadeals.catalog', $index, 600);
                Log::info('pvadeals.catalog.loaded', ['count' => count($index)]);
            }

            return $index;
        } catch (\Throwable $e) {
            Log::warning('pvadeals.catalog.exception', ['error' => $e->getMessage()]);
            return [];
        }
    }

    /** Returns catalog as a flat array for the frontend with STR + LTR prices. */
    public function getPublicCatalog(): array
    {
        $catalog = $this->getCatalog();
        if (empty($catalog)) return [];

        $svc = \App\Models\Service::where('provider', 'pvadeals')->where('category', 'virtual_number')->first();
        $markup = $svc ? ((float) ($svc->markup_percent ?? 15)) : 15;
        $m = 1 + $markup / 100;

        $items = [];
        foreach ($catalog as $slug => $info) {
            if ($info['price'] <= 0) continue;
            $ltrPrices = [];
            foreach ([3 => 'ltr3', 7 => 'ltr7', 14 => 'ltr14', 30 => 'ltr30'] as $days => $key) {
                if ($info[$key] > 0) {
                    $ltrPrices[$days] = round($info[$key] * $m, 4);
                }
            }
            $items[] = [
                'slug'       => $slug,
                'name'       => $info['name'],
                'price_usd'  => round($info['price'] * $m, 4),
                'ltr_prices' => $ltrPrices,
                'image_url'  => $info['image_url'] ?? '',
            ];
        }
        usort($items, fn($a, $b) => strcmp($a['name'], $b['name']));
        return $items;
    }

    private function findService(string $service): ?array
    {
        $catalog = $this->getCatalog();
        $key = strtolower(trim($service));

        if (isset($catalog[$key])) return $catalog[$key];

        foreach ($catalog as $name => $info) {
            if (str_contains($name, $key) || str_contains($key, $name)) {
                return $info;
            }
        }

        return null;
    }

    private function isUsaCountry(string $country): bool
    {
        return in_array(strtolower(trim($country)), ['us', 'usa', 'united states', 'united states of america'], true);
    }

    public function getPrice(string $service, string $country): ?Money
    {
        if (! $this->isUsaCountry($country)) return null;

        $svc = $this->findService($service);
        if (! $svc || $svc['price'] <= 0) return null;

        return Money::fromDecimal(sprintf('%.4f', $svc['price']), 'USD');
    }

    public function getLtrPrice(string $service, int $duration): ?Money
    {
        if ($duration === 28) {
            return Money::fromDecimal('12.99', 'USD'); // All-Services fixed price
        }

        $svc = $this->findService($service);
        if (! $svc) return null;

        $key = 'ltr' . $duration;
        $price = $svc[$key] ?? 0;
        if ($price <= 0) return null;

        return Money::fromDecimal(sprintf('%.4f', $price), 'USD');
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->getPrice($service, $country) !== null;
    }

    public function getCountryPrices(string $service): array
    {
        $svc = $this->findService($service);
        if (! $svc || $svc['price'] <= 0) return [];

        return [[
            'country_code' => 'US',
            'count'        => 1,
            'price_usd'    => $svc['price'],
        ]];
    }

    public function purchase(string $service, string $country): array
    {
        if (! $this->isUsaCountry($country)) {
            throw new ServiceUnavailableException('PVADeals only provides US numbers.');
        }

        $svc = $this->findService($service);
        if (! $svc) {
            throw new ServiceUnavailableException('Service not available on PVADeals. Please try a different provider.');
        }

        Log::info('pvadeals.purchase.attempt', ['service' => $svc['name'], 'service_id' => $svc['id']]);

        $res = $this->client()->asJson()->post('/purchase', [
            'services' => [['serviceId' => $svc['id']]],
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

    public function purchaseLtr(string $service, int $duration): array
    {
        $serviceId = $duration === 28 ? 'ALL_SERVICES' : ($this->findService($service)['id'] ?? null);

        if (! $serviceId) {
            throw new ServiceUnavailableException('Service not available on PVADeals.');
        }

        Log::info('pvadeals.ltr.purchase.attempt', ['service' => $service, 'duration' => $duration]);

        $res = $this->client()->asJson()->post('/purchase-ltr', [
            'duration'  => $duration,
            'serviceId' => $serviceId,
        ]);

        Log::info('pvadeals.ltr.purchase.response', [
            'status' => $res->status(),
            'body'   => substr($res->body(), 0, 400),
        ]);

        if (! $res->successful() || empty($res->json('success'))) {
            throw new ServiceUnavailableException('No LTR numbers available. Please try again later.');
        }

        $data = $res->json('data') ?? null;
        if (! $data || empty($data['_id']) || empty($data['number'])) {
            throw new \RuntimeException('PVADeals LTR unexpected response: ' . substr($res->body(), 0, 200));
        }

        return [
            'provider_order_id' => (string) $data['_id'],
            'phone_number'      => '+' . ltrim((string) $data['number'], '+'),
            'expires_at'        => $data['endTime'] ?? now()->addDays($duration)->toISOString(),
            'auto_renew_enable' => (bool) ($data['autoRenewEnable'] ?? false),
            'allow_flag'        => (bool) ($data['allowFlag'] ?? true),
            'allow_reuse'       => false,
            'number_type'       => 'LTR',
            'duration'          => $duration,
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
            'reuse_counter'     => (int) ($data['reuseCounter'] ?? 0),
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

            $data = $res->json('data') ?? [];

            $message = (string) ($data['message'] ?? $data['sms'] ?? $data['code'] ?? '');
            if ($message) {
                preg_match('/\b(\d{4,8})\b/', $message, $m);
                if (! empty($m[1])) return $m[1];
            }

            if (($data['status'] ?? '') === 'COMPLETED') {
                return null;
            }

            return null;
        } catch (\Throwable) {
            return null;
        }
    }
}
