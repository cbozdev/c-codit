<?php

namespace App\Services\Smm;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Standard SMM panel integration (compatible with Peakerr, JustAnotherPanel, etc.).
 *
 * Use the static factories rather than constructing directly:
 *   SmmPanelService::forBoost()    → SMM_PANEL_URL / SMM_PANEL_KEY
 *   SmmPanelService::forAccounts() → SMM_ACCOUNTS_PANEL_URL / SMM_ACCOUNTS_PANEL_KEY
 */
class SmmPanelService
{
    public function __construct(
        private readonly string $url,
        private readonly string $key,
    ) {}

    public static function forBoost(): static
    {
        return new static(
            rtrim((string) config('services.smmpanel.url', ''), '/'),
            (string) config('services.smmpanel.key', ''),
        );
    }

    public static function forAccounts(): static
    {
        $url = config('services.smm_accounts_panel.url') ?: config('services.smmpanel.url', '');
        $key = config('services.smm_accounts_panel.key') ?: config('services.smmpanel.key', '');
        return new static(rtrim((string) $url, '/'), (string) $key);
    }

    public static function forCategory(string $category): static
    {
        return $category === 'smm_accounts' ? static::forAccounts() : static::forBoost();
    }

    private function cachePrefix(): string
    {
        return 'smmpanel.' . substr(md5($this->url), 0, 8) . '.';
    }

    private function post(array $params): mixed
    {
        $params['key'] = $this->key;

        $res = Http::asForm()->timeout(30)->post($this->url, $params);

        if (! $res->successful()) {
            throw new \RuntimeException("SMM panel HTTP {$res->status()}: " . substr($res->body(), 0, 200));
        }

        $body = $res->json();

        if (isset($body['error'])) {
            throw new \RuntimeException('SMM panel: ' . $body['error']);
        }

        return $body;
    }

    // ─── Service catalog ──────────────────────────────────────────────────────

    public function getServices(): array
    {
        $cacheKey = $this->cachePrefix() . 'services';
        return Cache::remember($cacheKey, 3600, function () {
            try {
                $data = $this->post(['action' => 'services']);
                if (! is_array($data)) return [];
                Log::info('smmpanel.services.loaded', ['count' => count($data), 'panel' => $this->url]);
                return $data;
            } catch (\Throwable $e) {
                Log::warning('smmpanel.services.error', ['error' => $e->getMessage(), 'panel' => $this->url]);
                return [];
            }
        });
    }

    public function getServiceById(int $serviceId): ?array
    {
        foreach ($this->getServices() as $svc) {
            if ((int) ($svc['service'] ?? 0) === $serviceId) {
                return $svc;
            }
        }
        return null;
    }

    /**
     * Filter panel services by our category (smm_boost vs smm_accounts)
     * and optionally by platform keyword.
     *
     * Boost panel (Peakerr): followers, likes, views, comments, shares, etc.
     * Accounts panel (JustAnotherPanel): services with "account", "pva", "aged", "verified" in the name.
     */
    public function getCatalog(string $category, ?string $platform = null, float $markup = 15): array
    {
        $services = $this->getServices();

        $boostKeywords   = ['followers', 'likes', 'views', 'comments', 'shares', 'subscribers',
                            'retweets', 'impressions', 'plays', 'streams', 'reposts', 'saves',
                            'reactions', 'story views', 'reel views', 'watch time'];

        $accountKeywords = ['account', 'accounts', 'pva', 'aged', 'verified'];

        $targetKeywords = $category === 'smm_accounts' ? $accountKeywords : $boostKeywords;

        $services = array_filter($services, function ($svc) use ($targetKeywords) {
            $name = strtolower((string) ($svc['name'] ?? ''));
            foreach ($targetKeywords as $kw) {
                if (str_contains($name, $kw)) return true;
            }
            return false;
        });

        // Filter by platform
        if ($platform && $platform !== 'all') {
            $pkw = $this->platformKeywords($platform);
            $services = array_filter($services, function ($svc) use ($pkw) {
                $haystack = strtolower((string) ($svc['name'] ?? '') . ' ' . (string) ($svc['category'] ?? ''));
                foreach ($pkw as $kw) {
                    if (str_contains($haystack, $kw)) return true;
                }
                return false;
            });
        }

        return $this->format(array_values($services), $markup);
    }

    private function platformKeywords(string $platform): array
    {
        return match ($platform) {
            'instagram' => ['instagram', 'ig '],
            'youtube'   => ['youtube', 'yt '],
            'tiktok'    => ['tiktok', 'tik tok'],
            'twitter'   => ['twitter', 'x -', 'tweet'],
            'facebook'  => ['facebook', 'fb '],
            'telegram'  => ['telegram'],
            'snapchat'  => ['snapchat'],
            'spotify'   => ['spotify'],
            'linkedin'  => ['linkedin'],
            'pinterest' => ['pinterest'],
            'threads'   => ['threads'],
            default     => [$platform],
        };
    }

    public function format(array $services, float $markup): array
    {
        return array_map(function ($svc) use ($markup) {
            $rate = (float) ($svc['rate'] ?? 0);
            return [
                'service_id'   => (int) ($svc['service'] ?? 0),
                'name'         => $svc['name'] ?? 'Unknown',
                'category'     => $svc['category'] ?? '',
                'rate_per_1k'  => $rate,
                'price_per_1k' => round($rate * (1 + $markup / 100), 4),
                'min'          => (int) ($svc['min'] ?? 10),
                'max'          => (int) ($svc['max'] ?? 100000),
                'type'         => $svc['type'] ?? 'Default',
                'refill'       => (bool) ($svc['refill'] ?? false),
                'cancel'       => (bool) ($svc['cancel'] ?? false),
            ];
        }, $services);
    }

    // ─── Orders ───────────────────────────────────────────────────────────────

    public function placeOrder(int $serviceId, string $link, int $quantity): array
    {
        Log::info('smmpanel.order.attempt', compact('serviceId', 'link', 'quantity') + ['panel' => $this->url]);

        $params = ['action' => 'add', 'service' => $serviceId, 'quantity' => $quantity];
        if ($link !== '') {
            $params['link'] = $link;
        }

        $result = $this->post($params);

        Log::info('smmpanel.order.result', ['result' => $result]);

        if (empty($result['order'])) {
            throw new \RuntimeException('SMM panel did not return an order ID: ' . json_encode($result));
        }

        return $result;
    }

    public function getOrderStatus(string $orderId): array
    {
        try {
            $result = $this->post(['action' => 'status', 'order' => $orderId]);
            return is_array($result) ? $result : [];
        } catch (\Throwable $e) {
            Log::warning('smmpanel.status.error', ['order' => $orderId, 'error' => $e->getMessage()]);
            return ['status' => 'Unknown'];
        }
    }

    public function getBalance(): float
    {
        try {
            $result = $this->post(['action' => 'balance']);
            return (float) ($result['balance'] ?? 0);
        } catch (\Throwable) {
            return 0.0;
        }
    }
}
