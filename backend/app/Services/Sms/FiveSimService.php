<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Services\Support\ExternalHttp;
use App\Support\Money;
use RuntimeException;

class FiveSimService implements SmsNumberProvider
{
    public function code(): string { return '5sim'; }

    private function client()
    {
        return ExternalHttp::for('5sim', config('services.fivesim.base_url'))
            ->withToken((string) config('services.fivesim.api_key'));
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $res = $this->client()->get('/guest/prices', [
            'country' => $country,
            'product' => $service,
        ]);
        $body = ExternalHttp::ensureSuccessful($res, '5sim.prices');

        $priceRub = null;
        foreach (($body[$country][$service] ?? []) as $operator => $info) {
            if (($info['count'] ?? 0) > 0) {
                $priceRub = (float) ($info['cost'] ?? 0);
                break;
            }
        }
        if ($priceRub === null) return null;

        $rate = (float) config('services.platform.rub_usd_rate', 0.011);
        $usd = $priceRub * $rate;
        return Money::fromDecimal(sprintf('%.2F', $usd), 'USD');
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->getPrice($service, $country) !== null;
    }

    public function purchase(string $service, string $country): array
    {
        $res = $this->client()->get("/user/buy/activation/{$country}/any/{$service}");

        if ($res->status() === 400 && str_contains((string) $res->body(), 'no free phones')) {
            throw new ServiceUnavailableException('No phone numbers available for this service/country.');
        }
        $body = ExternalHttp::ensureSuccessful($res, '5sim.purchase');

        if (empty($body['id']) || empty($body['phone'])) {
            throw new RuntimeException('5sim returned unexpected purchase response.');
        }

        return [
            'provider_order_id' => (string) $body['id'],
            'phone_number'      => (string) $body['phone'],
            'expires_at'        => $body['expires'] ?? null,
            'raw'               => $body,
        ];
    }

    public function cancel(string $providerOrderId): bool
    {
        $res = $this->client()->get("/user/cancel/{$providerOrderId}");
        return $res->successful();
    }

    public function fetchCode(string $providerOrderId): ?string
    {
        $res = $this->client()->get("/user/check/{$providerOrderId}");
        if (! $res->successful()) return null;
        $body = (array) $res->json();
        foreach (($body['sms'] ?? []) as $sms) {
            if (! empty($sms['code'])) return (string) $sms['code'];
        }
        return null;
    }
}
