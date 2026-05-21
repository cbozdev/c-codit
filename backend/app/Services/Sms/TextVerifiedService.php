<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * TextVerified virtual number provider.
 *
 * Auth flow: POST /api/Auth with X-SIMPLEAPI-APPLICATION-KEY header
 *            → returns bearer token (cached for 23 h)
 *
 * Docs: https://www.textverified.com/api/reference
 */
class TextVerifiedService implements SmsNumberProvider
{
    public function code(): string { return 'textverified'; }

    private const BASE_URL   = 'https://www.textverified.com/api';
    private const TOKEN_TTL  = 82800; // 23 h in seconds

    // Map internal service slugs → TextVerified target names
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
            ])->post(self::BASE_URL . '/Auth');

            if (! $res->successful()) {
                throw new ServiceUnavailableException('TextVerified auth failed: ' . $res->body());
            }

            $token = $res->json('token') ?? $res->body();
            if (empty($token)) {
                throw new ServiceUnavailableException('TextVerified returned empty auth token.');
            }

            return trim((string) $token, '"');
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
        $s = strtolower(trim($service));
        return self::TARGET_MAP[$s] ?? null;
    }

    /** Fetch all targets from TextVerified and cache for 10 min. */
    private function targets(): array
    {
        return Cache::remember('textverified.targets', 600, function () {
            try {
                $res = $this->client()->get('/Targets');
                if (! $res->successful()) return [];
                return $res->json() ?? [];
            } catch (\Throwable $e) {
                Log::warning('textverified.targets.error', ['error' => $e->getMessage()]);
                return [];
            }
        });
    }

    private function targetInfo(string $targetName): ?array
    {
        foreach ($this->targets() as $t) {
            if (strtolower((string)($t['name'] ?? '')) === strtolower($targetName)) {
                return $t;
            }
        }
        return null;
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $target = $this->resolveTarget($service);
        if (! $target) return null;

        $info = $this->targetInfo($target);
        if (! $info) return null;

        $priceUsd = (float) ($info['price'] ?? $info['smsPrice'] ?? 0);
        if ($priceUsd <= 0) return null;

        return Money::fromDecimal(sprintf('%.4f', $priceUsd), 'USD');
    }

    public function isAvailable(string $service, string $country): bool
    {
        $target = $this->resolveTarget($service);
        if (! $target) return false;

        $info = $this->targetInfo($target);
        if (! $info) return false;

        $available = (int) ($info['available'] ?? $info['count'] ?? 1);
        return $available > 0;
    }

    public function purchase(string $service, string $country): array
    {
        $target = $this->resolveTarget($service);
        if (! $target) {
            throw new ServiceUnavailableException("Service '{$service}' is not supported on TextVerified.");
        }

        Log::info('textverified.purchase.attempt', ['target' => $target]);

        try {
            $res = $this->client()->post('/SimpleVerifications', [
                'targetName'   => $target,
                'capabilities' => 'SMS',
            ]);
        } catch (\Throwable $e) {
            // Token may have expired — clear cache and retry once
            Cache::forget('textverified.bearer_token');
            $res = $this->client()->post('/SimpleVerifications', [
                'targetName'   => $target,
                'capabilities' => 'SMS',
            ]);
        }

        Log::info('textverified.purchase.response', [
            'status' => $res->status(),
            'body'   => substr($res->body(), 0, 400),
        ]);

        if (! $res->successful()) {
            $msg = $res->json('message') ?? $res->body();
            throw new ServiceUnavailableException('TextVerified error: ' . $msg);
        }

        $body = $res->json();

        $id     = $body['id'] ?? $body['verificationId'] ?? null;
        $number = $body['number'] ?? $body['phoneNumber'] ?? null;

        if (! $id || ! $number) {
            throw new \RuntimeException('TextVerified returned unexpected response: ' . json_encode($body));
        }

        return [
            'provider_order_id' => (string) $id,
            'phone_number'      => '+' . ltrim((string) $number, '+'),
            'expires_at'        => isset($body['expiresAt']) ? $body['expiresAt'] : null,
            'raw'               => $body,
        ];
    }

    public function cancel(string $providerOrderId): bool
    {
        try {
            $res = $this->client()->delete("/SimpleVerifications/{$providerOrderId}");
            return $res->successful();
        } catch (\Throwable $e) {
            Log::warning('textverified.cancel.error', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function fetchCode(string $providerOrderId): ?string
    {
        try {
            $res = $this->client()->get("/SimpleVerifications/{$providerOrderId}");
            if (! $res->successful()) return null;

            $body = $res->json();

            // Direct code field
            if (! empty($body['code'])) return (string) $body['code'];
            if (! empty($body['smsCode'])) return (string) $body['smsCode'];

            // Extract from full SMS text
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

    /** Return all available targets with prices (used by admin health check). */
    public function listTargets(): array
    {
        return $this->targets();
    }
}
