<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Services\Support\ExternalHttp;
use App\Support\Money;
use RuntimeException;

/**
 * sms-activate.org uses a single GET endpoint with `action` parameters that
 * return responses like "ACCESS_NUMBER:ID:NUMBER" or "STATUS_OK:CODE".
 */
class SmsActivateService implements SmsNumberProvider
{
    public function code(): string { return 'smsactivate'; }

    // Maps frontend service slugs → sms-activate internal codes
    private const SERVICE_MAP = [
        'telegram'   => 'tg',
        'whatsapp'   => 'wa',
        'facebook'   => 'fb',
        'instagram'  => 'ig',
        'twitter'    => 'tw',
        'tiktok'     => 'tk',
        'snapchat'   => 'sc',
        'discord'    => 'ds',
        'viber'      => 'vi',
        'wechat'     => 'mb',
        'google'     => 'go',
        'apple'      => 'ap',
        'microsoft'  => 'ms',
        'amazon'     => 'am',
        'netflix'    => 'nf',
        'spotify'    => 'sp',
        'uber'       => 'ub',
        'paypal'     => 'pp',
        'tinder'     => 'ti',
        'bumble'     => 'bm',
        'badoo'      => 'bd',
        'hinge'      => 'hi',
        'binance'    => 'bn',
        'coinbase'   => 'cb',
    ];

    private function normalizeService(string $service): string
    {
        $s = strtolower(trim($service));
        return self::SERVICE_MAP[$s] ?? $s;
    }

    private function call(array $params): string
    {
        $params = array_merge([
            'api_key' => (string) config('services.smsactivate.api_key'),
        ], $params);

        try {
            $res = ExternalHttp::for('smsactivate', config('services.smsactivate.base_url'))
                ->asForm()->get('', $params);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new ServiceUnavailableException('SMS provider is temporarily unreachable. Please try again in a moment.');
        }

        if (! $res->successful()) {
            throw new RuntimeException('sms-activate: HTTP '.$res->status());
        }
        return trim((string) $res->body());
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $svc  = $this->normalizeService($service);
        $body = $this->call(['action' => 'getPrices', 'service' => $svc, 'country' => $country]);
        $data = json_decode($body, true);
        if (! is_array($data)) return null;

        $min = null;
        foreach (($data[$country][$svc] ?? []) as $price => $count) {
            if ((int) $count > 0 && ($min === null || (float) $price < $min)) {
                $min = (float) $price;
            }
        }
        if ($min === null) return null;

        $rate = (float) config('services.platform.rub_usd_rate', 0.011);
        return Money::fromDecimal(sprintf('%.2F', $min * $rate), 'USD');
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->getPrice($service, $country) !== null;
    }

    public function getCountryPrices(string $service): array
    {
        $svc = $this->normalizeService($service);

        try {
            $body = $this->call(['action' => 'getPrices', 'service' => $svc]);
            $data = json_decode($body, true);
            if (! is_array($data)) return [];
        } catch (\Throwable) {
            return [];
        }

        $rate    = (float) config('services.platform.rub_usd_rate', 0.011);
        $results = [];

        foreach ($data as $countryId => $services) {
            $prices     = $services[$svc] ?? [];
            $bestPrice  = null;
            $totalCount = 0;

            foreach ($prices as $price => $count) {
                $cnt  = (int) $count;
                $cost = (float) $price;
                if ($cnt > 0 && $cost > 0) {
                    $totalCount += $cnt;
                    if ($bestPrice === null || $cost < $bestPrice) $bestPrice = $cost;
                }
            }

            if ($bestPrice === null || $totalCount <= 0) continue;

            $results[] = [
                'country_code' => (string) $countryId,
                'count'        => $totalCount,
                'price_usd'    => $bestPrice * $rate,
            ];
        }

        usort($results, fn($a, $b) => $a['price_usd'] <=> $b['price_usd']);
        return $results;
    }

    public function purchase(string $service, string $country): array
    {
        $svc  = $this->normalizeService($service);
        $body = $this->call(['action' => 'getNumber', 'service' => $svc, 'country' => $country]);

        if ($body === 'NO_NUMBERS') {
            throw new ServiceUnavailableException('No numbers available.');
        }
        if (! str_starts_with($body, 'ACCESS_NUMBER')) {
            throw new RuntimeException("sms-activate error: {$body}");
        }

        [, $id, $phone] = array_pad(explode(':', $body, 3), 3, null);
        if (! $id || ! $phone) {
            throw new RuntimeException('sms-activate returned malformed response.');
        }

        return [
            'provider_order_id' => (string) $id,
            'phone_number'      => '+'.ltrim((string) $phone, '+'),
            'expires_at'        => null,
            'raw'               => ['response' => $body],
        ];
    }

    public function cancel(string $providerOrderId): bool
    {
        $body = $this->call(['action' => 'setStatus', 'id' => $providerOrderId, 'status' => 8]);
        return str_starts_with($body, 'ACCESS_');
    }

    public function fetchCode(string $providerOrderId): ?string
    {
        $body = $this->call(['action' => 'getStatus', 'id' => $providerOrderId]);
        if (str_starts_with($body, 'STATUS_OK:')) {
            return trim(substr($body, strlen('STATUS_OK:')));
        }
        return null;
    }
}
