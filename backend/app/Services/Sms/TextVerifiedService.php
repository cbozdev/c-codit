<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * TextVerified virtual number provider (API v2).
 *
 * Auth:    POST /api/pub/v2/auth  (header: X-SIMPLEAPI-APPLICATION-KEY)
 *          → returns {"token": "..."}, cached 23 h
 * Services: GET /api/pub/v2/services  (cached 10 min)
 * Purchase: POST /api/pub/v2/verifications → 201 with Location header
 * Fetch:    GET  /api/pub/v2/verifications/{id}
 * Cancel:   POST /api/pub/v2/verifications/{id}/cancel
 */
class TextVerifiedService implements SmsNumberProvider
{
    public function code(): string { return 'textverified'; }

    private const BASE_URL  = 'https://www.textverified.com';
    private const TOKEN_TTL = 82800; // 23 h

    // Map internal service slugs → TextVerified service names (case-sensitive as returned by API)
    private const TARGET_MAP = [
        'telegram'   => 'Telegram',
        'whatsapp'   => 'WhatsApp',
        'facebook'   => 'Facebook',
        'instagram'  => 'Instagram',
        'twitter'    => 'Twitter',
        'google'     => 'Google',
        'apple'      => 'Apple',
        'microsoft'  => 'Microsoft',
        'discord'    => 'Discord',
        'snapchat'   => 'Snapchat',
        'tinder'     => 'Tinder',
        'hinge'      => 'Hinge',
        'bumble'     => 'Bumble',
        'uber'       => 'Uber',
        'lyft'       => 'Lyft',
        'amazon'     => 'Amazon',
        'paypal'     => 'PayPal',
        'coinbase'   => 'Coinbase',
        'binance'    => 'Binance',
        'spotify'    => 'Spotify',
        'netflix'    => 'Netflix',
        'airbnb'     => 'Airbnb',
        'doordash'   => 'DoorDash',
        'pof'        => 'Plenty of Fish',
        'badoo'      => 'Badoo',
        'line'       => 'Line',
        'viber'      => 'Viber',
        'wechat'     => 'WeChat',
        'yahoo'      => 'Yahoo',
        'reddit'     => 'Reddit',
        'linkedin'   => 'LinkedIn',
        'tiktok'     => 'TikTok',
    ];

    private function apiKey(): string
    {
        return (string) config('services.textverified.api_key');
    }

    private function bearerToken(): string
    {
        return Cache::remember('textverified.bearer_token', self::TOKEN_TTL, function () {
            $res = Http::withHeaders([
                'X-SIMPLEAPI-APPLICATION-KEY' => $this->apiKey(),
                'Accept'                      => 'application/json',
            ])->post(self::BASE_URL . '/api/pub/v2/auth');

            if (! $res->successful()) {
                throw new \RuntimeException('TextVerified auth failed: ' . $res->body());
            }

            $token = $res->json('token') ?? '';
            if (empty($token)) {
                throw new \RuntimeException('TextVerified returned empty auth token.');
            }

            return (string) $token;
        });
    }

    private function client()
    {
        return Http::withToken($this->bearerToken())
            ->baseUrl(self::BASE_URL)
            ->acceptJson()
            ->timeout(30);
    }

    private function resolveTarget(string $service): ?string
    {
        return self::TARGET_MAP[strtolower(trim($service))] ?? null;
    }

    /** Fetch available services from TextVerified, cached 10 min. */
    private function services(): array
    {
        return Cache::remember('textverified.services', 600, function () {
            try {
                $res = $this->client()->get('/api/pub/v2/services');
                if (! $res->successful()) return [];
                return $res->json() ?? [];
            } catch (\Throwable $e) {
                Log::warning('textverified.services.error', ['error' => $e->getMessage()]);
                return [];
            }
        });
    }

    private function serviceInfo(string $serviceName): ?array
    {
        foreach ($this->services() as $s) {
            if (strtolower((string)($s['name'] ?? '')) === strtolower($serviceName)) {
                return $s;
            }
        }
        return null;
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $target = $this->resolveTarget($service);
        if (! $target) return null;

        $info = $this->serviceInfo($target);
        if (! $info) return null;

        $priceUsd = (float) ($info['price'] ?? $info['smsPrice'] ?? 0);
        if ($priceUsd <= 0) return null;

        return Money::fromDecimal(sprintf('%.4f', $priceUsd), 'USD');
    }

    public function isAvailable(string $service, string $country): bool
    {
        $target = $this->resolveTarget($service);
        if (! $target) return false;

        $info = $this->serviceInfo($target);
        if (! $info) return false;

        $available = (int) ($info['available'] ?? $info['count'] ?? 1);
        return $available > 0;
    }

    public function purchase(string $service, string $country): array
    {
        $target = $this->resolveTarget($service);
        if (! $target) {
            throw new \RuntimeException("Service '{$service}' is not supported on TextVerified.");
        }

        Log::info('textverified.purchase.attempt', ['target' => $target]);

        $doRequest = fn () => $this->client()
            ->withOptions(['allow_redirects' => false])
            ->post('/api/pub/v2/verifications', [
                'serviceName'  => $target,
                'capabilities' => 'SMS',
            ]);

        try {
            $res = $doRequest();
        } catch (\Throwable $e) {
            // Token may have expired — clear cache and retry once
            Cache::forget('textverified.bearer_token');
            $res = $doRequest();
        }

        Log::info('textverified.purchase.response', [
            'status'   => $res->status(),
            'location' => $res->header('Location'),
            'body'     => substr($res->body(), 0, 400),
        ]);

        // API returns 201 Created with a Location header pointing to the verification
        if ($res->status() !== 201 && ! $res->successful()) {
            $msg = $res->json('message') ?? $res->body();
            throw new \RuntimeException('TextVerified error: ' . $msg);
        }

        // Follow the Location header to get full verification details
        $location = $res->header('Location') ?? '';
        $body      = $res->json() ?? [];

        // Derive the verification ID from the Location path or body
        $id = null;
        if ($location) {
            $id = basename(parse_url($location, PHP_URL_PATH));
        }
        $id     = $id ?: ($body['id'] ?? $body['verificationId'] ?? null);
        $number = $body['number'] ?? $body['phoneNumber'] ?? null;

        // If number not in creation response, fetch the resource
        if (! $number && $id) {
            $detail = $this->client()->get("/api/pub/v2/verifications/{$id}");
            if ($detail->successful()) {
                $dBody  = $detail->json();
                $number = $dBody['number'] ?? $dBody['phoneNumber'] ?? null;
                $body   = $dBody;
            }
        }

        if (! $id || ! $number) {
            throw new \RuntimeException('TextVerified returned unexpected response: ' . json_encode($body));
        }

        return [
            'provider_order_id' => (string) $id,
            'phone_number'      => '+' . ltrim((string) $number, '+'),
            'expires_at'        => $body['expiresAt'] ?? null,
            'raw'               => $body,
        ];
    }

    public function cancel(string $providerOrderId): bool
    {
        try {
            $res = $this->client()->post("/api/pub/v2/verifications/{$providerOrderId}/cancel");
            return $res->successful();
        } catch (\Throwable $e) {
            Log::warning('textverified.cancel.error', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function fetchCode(string $providerOrderId): ?string
    {
        try {
            $res = $this->client()->get("/api/pub/v2/verifications/{$providerOrderId}");
            if (! $res->successful()) return null;

            $body = $res->json();

            if (! empty($body['code'])) return (string) $body['code'];
            if (! empty($body['smsCode'])) return (string) $body['smsCode'];

            $text = $body['sms'] ?? $body['smsText'] ?? $body['message'] ?? '';
            if ($text) {
                preg_match('/\b(\d{4,8})\b/', (string) $text, $m);
                if (! empty($m[1])) return $m[1];
            }

            return null;
        } catch (\Throwable $e) {
            Log::warning('textverified.fetchCode.error', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /** Return all available services with prices (used by admin health check). */
    public function listTargets(): array
    {
        return $this->services();
    }
}
