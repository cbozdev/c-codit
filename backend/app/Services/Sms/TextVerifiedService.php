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
 * Auth:                POST /api/pub/v2/auth (X-SIMPLEAPI-APPLICATION-KEY header)
 * Service list:        GET  /api/pub/v2/services?numberType=mobile&reservationType=verification
 * Verification price:  POST /api/pub/v2/pricing/verifications
 * Verification avail:  POST /api/pub/v2/inventory/verifications
 * Create verification: POST /api/pub/v2/verifications  → 201 + Location header
 * Fetch verification:  GET  /api/pub/v2/verifications/{id}
 * Fetch SMS:           GET  /api/pub/v2/sms?reservationId={id}&reservationType=verification
 * Cancel:              POST /api/pub/v2/verifications/{id}/cancel
 *
 * Rental price:        POST /api/pub/v2/pricing/rentals
 * Rental avail:        POST /api/pub/v2/inventory/rentals
 * Create rental:       POST /api/pub/v2/rentals → 201 + Location header
 * Cancel rental:       POST /api/pub/v2/rentals/{id}/cancel  (non-renewable) or refund
 */
class TextVerifiedService implements SmsNumberProvider
{
    public function code(): string { return 'textverified'; }

    private const BASE_URL  = 'https://www.textverified.com';
    private const TOKEN_TTL = 82800; // 23 h

    // Rental durations offered on the platform
    public const RENTAL_DURATIONS = [
        'oneDay'      => '1 Day',
        'threeDay'    => '3 Days',
        'sevenDay'    => '7 Days',
        'fourteenDay' => '14 Days',
        'thirtyDay'   => '30 Days',
    ];

    // Map internal service slugs → TextVerified service names
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

    /** Returns a Decodo HTTP proxy URL if credentials are configured, or null. */
    private function proxyUrl(): ?string
    {
        $user = config('services.decodo.username');
        $pass = config('services.decodo.password');
        if (empty($user) || empty($pass)) return null;
        return "http://{$user}:{$pass}@gate.decodo.com:7777";
    }

    /** Base HTTP client with optional Decodo proxy to bypass Cloudflare. */
    private function baseHttp()
    {
        $http = Http::timeout(30);
        $proxy = $this->proxyUrl();
        if ($proxy) {
            $http = $http->withOptions(['proxy' => $proxy]);
        }
        return $http;
    }

    private function bearerToken(): string
    {
        return Cache::remember('textverified.bearer_token', self::TOKEN_TTL, function () {
            $res = $this->baseHttp()
                ->withHeaders([
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
        return $this->baseHttp()
            ->withToken($this->bearerToken())
            ->baseUrl(self::BASE_URL)
            ->acceptJson();
    }

    private function resolveTarget(string $service): ?string
    {
        return self::TARGET_MAP[strtolower(trim($service))] ?? null;
    }

    /** Fetch available verification services, cached 10 min. */
    private function services(): array
    {
        return Cache::remember('textverified.services', 600, function () {
            try {
                $res = $this->client()->get('/api/pub/v2/services', [
                    'numberType'      => 'mobile',
                    'reservationType' => 'verification',
                ]);
                if (! $res->successful()) return [];
                return $res->json() ?? [];
            } catch (\Throwable $e) {
                Log::warning('textverified.services.error', ['error' => $e->getMessage()]);
                return [];
            }
        });
    }

    /** Fetch available rental services, cached 10 min. */
    private function rentalServices(): array
    {
        return Cache::remember('textverified.rental_services', 600, function () {
            try {
                $res = $this->client()->get('/api/pub/v2/services', [
                    'numberType'      => 'mobile',
                    'reservationType' => 'renewable',
                ]);
                if (! $res->successful()) return [];
                return $res->json() ?? [];
            } catch (\Throwable $e) {
                Log::warning('textverified.rental_services.error', ['error' => $e->getMessage()]);
                return [];
            }
        });
    }

    // ─── Verification (one-time SMS) ────────────────────────────────────────

    public function getPrice(string $service, string $country): ?Money
    {
        $target = $this->resolveTarget($service);
        if (! $target) {
            Log::warning('textverified.getPrice.no_target', ['service' => $service]);
            return null;
        }

        try {
            $res = $this->client()->post('/api/pub/v2/pricing/verifications', [
                'serviceName' => $target,
                'numberType'  => 'mobile',
                'capability'  => 'sms',
                'areaCode'    => false,
                'carrier'     => false,
            ]);

            Log::info('textverified.getPrice.response', [
                'service' => $service,
                'target'  => $target,
                'status'  => $res->status(),
                'body'    => substr($res->body(), 0, 300),
            ]);

            if (! $res->successful()) return null;

            $price = (float) ($res->json('price') ?? 0);
            if ($price <= 0) return null;

            return Money::fromDecimal(sprintf('%.4f', $price), 'USD');
        } catch (\Throwable $e) {
            Log::warning('textverified.getPrice.error', ['service' => $service, 'error' => $e->getMessage()]);
            return null;
        }
    }

    public function isAvailable(string $service, string $country): bool
    {
        $target = $this->resolveTarget($service);
        if (! $target) return false;

        try {
            $res = $this->client()->post('/api/pub/v2/inventory/verifications', [
                'numberType'  => 'mobile',
                'serviceName' => $target,
                'capability'  => 'sms',
            ]);
            if (! $res->successful()) return false;
            return (int) ($res->json('availableQuantity') ?? 0) > 0;
        } catch (\Throwable $e) {
            return false;
        }
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
                'serviceName' => $target,
                'numberType'  => 'mobile',
                'capability'  => 'sms',
            ]);

        try {
            $res = $doRequest();
        } catch (\Throwable) {
            Cache::forget('textverified.bearer_token');
            $res = $doRequest();
        }

        Log::info('textverified.purchase.response', [
            'status'   => $res->status(),
            'location' => $res->header('Location'),
            'body'     => substr($res->body(), 0, 400),
        ]);

        if ($res->status() !== 201 && ! $res->successful()) {
            throw new \RuntimeException('TextVerified error: ' . ($res->json('message') ?? $res->body()));
        }

        $location = $res->header('Location') ?? '';
        $body     = $res->json() ?? [];

        $id = $location ? basename(parse_url($location, PHP_URL_PATH)) : null;
        $id = $id ?: ($body['id'] ?? null);
        $number = $body['number'] ?? null;

        // Fetch details if number not in creation response
        if (! $number && $id) {
            $detail = $this->client()->get("/api/pub/v2/verifications/{$id}");
            if ($detail->successful()) {
                $dBody  = $detail->json();
                $number = $dBody['number'] ?? null;
                $body   = $dBody;
            }
        }

        if (! $id || ! $number) {
            throw new \RuntimeException('TextVerified unexpected response: ' . json_encode($body));
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
            // Fetch SMS messages for this verification
            $res = $this->client()->get('/api/pub/v2/sms', [
                'reservationId'   => $providerOrderId,
                'reservationType' => 'verification',
            ]);

            if ($res->successful()) {
                $messages = $res->json('data') ?? [];
                foreach ($messages as $msg) {
                    $text = $msg['message'] ?? $msg['text'] ?? $msg['body'] ?? '';
                    if (! empty($text)) {
                        // Try direct code fields
                        if (! empty($msg['code'])) return (string) $msg['code'];
                        // Extract from message text
                        preg_match('/\b(\d{4,8})\b/', (string) $text, $m);
                        if (! empty($m[1])) return $m[1];
                    }
                }
            }

            // Fallback: GET the verification directly
            $vRes = $this->client()->get("/api/pub/v2/verifications/{$providerOrderId}");
            if (! $vRes->successful()) return null;

            $body = $vRes->json();
            if (! empty($body['code'])) return (string) $body['code'];

            return null;
        } catch (\Throwable $e) {
            Log::warning('textverified.fetchCode.error', ['error' => $e->getMessage()]);
            return null;
        }
    }

    // ─── Rental (long-term number) ───────────────────────────────────────────

    public function getRentalPrice(string $service, string $duration = 'oneDay'): ?Money
    {
        $target = $this->resolveTarget($service);
        if (! $target) return null;

        try {
            $res = $this->client()->post('/api/pub/v2/pricing/rentals', [
                'serviceName' => $target,
                'numberType'  => 'mobile',
                'capability'  => 'sms',
                'areaCode'    => false,
                'carrier'     => false,
                'isRenewable' => false,
                'duration'    => $duration,
            ]);
            if (! $res->successful()) return null;

            $price = (float) ($res->json('price') ?? 0);
            if ($price <= 0) return null;

            return Money::fromDecimal(sprintf('%.4f', $price), 'USD');
        } catch (\Throwable $e) {
            Log::warning('textverified.getRentalPrice.error', ['service' => $service, 'error' => $e->getMessage()]);
            return null;
        }
    }

    public function purchaseRental(string $service, string $duration = 'oneDay'): array
    {
        $target = $this->resolveTarget($service);
        if (! $target) {
            throw new \RuntimeException("Service '{$service}' is not supported for TextVerified rentals.");
        }

        Log::info('textverified.rental.attempt', ['target' => $target, 'duration' => $duration]);

        $doRequest = fn () => $this->client()
            ->withOptions(['allow_redirects' => false])
            ->post('/api/pub/v2/reservations/rental', [
                'serviceName' => $target,
                'numberType'  => 'mobile',
                'capability'  => 'sms',
                'isRenewable' => false,
                'duration'    => $duration,
            ]);

        try {
            $res = $doRequest();
        } catch (\Throwable) {
            Cache::forget('textverified.bearer_token');
            $res = $doRequest();
        }

        Log::info('textverified.rental.response', [
            'status'   => $res->status(),
            'location' => $res->header('Location'),
            'body'     => substr($res->body(), 0, 400),
        ]);

        if ($res->status() !== 201 && ! $res->successful()) {
            throw new \RuntimeException('TextVerified rental error: ' . ($res->json('message') ?? $res->body()));
        }

        $location = $res->header('Location') ?? '';
        $body     = $res->json() ?? [];

        // Location header → /api/pub/v2/sales/{saleId}; fetch it to get reservation details
        $reservationId = $body['id'] ?? null;
        $number        = $body['number'] ?? null;

        if ($location) {
            $saleId  = basename(parse_url($location, PHP_URL_PATH));
            $saleRes = $this->client()->get("/api/pub/v2/sales/{$saleId}");
            if ($saleRes->successful()) {
                $sale = $saleRes->json();
                Log::info('textverified.rental.sale', ['saleId' => $saleId, 'sale' => $sale]);
                $reservationId = $reservationId ?: ($sale['reservationId'] ?? $sale['id'] ?? $saleId);
                $number        = $number ?: ($sale['number'] ?? null);
            }
        }

        // If still no number, fetch the nonrenewable reservation directly
        if (! $number && $reservationId) {
            $rRes = $this->client()->get("/api/pub/v2/reservations/rental/nonrenewable/{$reservationId}");
            if ($rRes->successful()) {
                $rBody         = $rRes->json();
                $number        = $rBody['number'] ?? null;
                $body          = array_merge($body, $rBody);
            }
        }

        if (! $reservationId || ! $number) {
            throw new \RuntimeException('TextVerified rental unexpected response: ' . json_encode($body));
        }

        return [
            'provider_order_id' => (string) $reservationId,
            'phone_number'      => '+' . ltrim((string) $number, '+'),
            'expires_at'        => $body['expiresAt'] ?? null,
            'duration'          => $duration,
            'raw'               => $body,
        ];
    }

    public function cancelRental(string $rentalId): bool
    {
        try {
            $res = $this->client()->post("/api/pub/v2/rentals/{$rentalId}/cancel");
            return $res->successful();
        } catch (\Throwable $e) {
            Log::warning('textverified.cancelRental.error', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function fetchRentalSms(string $rentalId): ?string
    {
        try {
            $res = $this->client()->get('/api/pub/v2/sms', [
                'reservationId'   => $rentalId,
                'reservationType' => 'nonrenewable',
            ]);
            if (! $res->successful()) return null;

            foreach ($res->json('data') ?? [] as $msg) {
                $text = $msg['message'] ?? $msg['text'] ?? $msg['body'] ?? '';
                if (! empty($text)) {
                    preg_match('/\b(\d{4,8})\b/', (string) $text, $m);
                    if (! empty($m[1])) return $m[1];
                }
            }
            return null;
        } catch (\Throwable $e) {
            Log::warning('textverified.fetchRentalSms.error', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /** List all available verification service names (for admin/health). */
    public function listTargets(): array
    {
        return $this->services();
    }
}
