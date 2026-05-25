<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * PVADeals virtual number integration (USA only, STR).
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
     * Returns array keyed by lowercase service name → ['id' => ..., 'price' => float]
     */
    private function getCatalog(): array
    {
        return Cache::remember('pvadeals.catalog', 600, function () {
            try {
                $res = $this->client()->get('/services/all');
                if (! $res->successful()) {
                    Log::warning('pvadeals.catalog.failed', ['status' => $res->status()]);
                    return [];
                }

                $services = $res->json('data.services') ?? [];
                $index = [];
                foreach ($services as $svc) {
                    $name = strtolower(trim((string) ($svc['name'] ?? '')));
                    if ($name && isset($svc['_id'])) {
                        $index[$name] = [
                            'id'    => (string) $svc['_id'],
                            'name'  => (string) $svc['name'],
                            'price' => (float) ($svc['STRprice'] ?? 0),
                        ];
                    }
                }

                Log::info('pvadeals.catalog.loaded', ['count' => count($index)]);
                return $index;
            } catch (\Throwable $e) {
                Log::warning('pvadeals.catalog.exception', ['error' => $e->getMessage()]);
                return [];
            }
        });
    }

    private function findService(string $service): ?array
    {
        $catalog = $this->getCatalog();
        $key = strtolower(trim($service));

        // Exact match first
        if (isset($catalog[$key])) return $catalog[$key];

        // Partial match (e.g. "airbnb" matches "airbnb (usa)")
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

        if (! $res->successful()) {
            $msg = $res->json('message') ?? $res->body();
            throw new ServiceUnavailableException('No numbers are available for this service. Please try again later.');
        }

        $body = $res->json();

        if (empty($body['success'])) {
            throw new ServiceUnavailableException('No numbers are available for this service. Please try again later.');
        }

        $request = $body['data']['requests'][0] ?? null;
        if (! $request || empty($request['_id']) || empty($request['number'])) {
            throw new \RuntimeException('PVADeals returned unexpected response: ' . json_encode($body));
        }

        return [
            'provider_order_id' => (string) $request['_id'],
            'phone_number'      => '+' . ltrim((string) $request['number'], '+'),
            'expires_at'        => $request['endTime'] ?? now()->addMinutes(20)->toISOString(),
            'raw'               => $request,
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

            // Try direct message/code fields (provider may include them)
            $message = (string) ($data['message'] ?? $data['sms'] ?? $data['code'] ?? '');
            if ($message) {
                preg_match('/\b(\d{4,8})\b/', $message, $m);
                if (! empty($m[1])) return $m[1];
            }

            // Status COMPLETED means SMS arrived (code delivered via webhook)
            if (($data['status'] ?? '') === 'COMPLETED') {
                return null; // Webhook already stored the code in delivery
            }

            return null;
        } catch (\Throwable) {
            return null;
        }
    }
}
