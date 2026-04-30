<?php

namespace App\Services\Smm;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Standard SMM panel integration (compatible with 90%+ of panels).
 *
 * Required env vars:
 *   SMM_PANEL_URL=https://yourpanel.com/api/v2
 *   SMM_PANEL_KEY=your_api_key
 */
class SmmPanelService
{
    private function apiUrl(): string
    {
        return rtrim((string) config('services.smmpanel.url'), '/');
    }

    private function key(): string
    {
        return (string) config('services.smmpanel.key');
    }

    private function post(array $params): mixed
    {
        $params['key'] = $this->key();

        $res = Http::asForm()->timeout(30)->post($this->apiUrl(), $params);

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
        return Cache::remember('smmpanel.services', 3600, function () {
            try {
                $data = $this->post(['action' => 'services']);
                if (! is_array($data)) return [];
                Log::info('smmpanel.services.loaded', ['count' => count($data)]);
                return $data;
            } catch (\Throwable $e) {
                Log::warning('smmpanel.services.error', ['error' => $e->getMessage()]);
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
     */
    public function getCatalog(string $category, ?string $platform = null, float $markup = 15): array
    {
        $services = $this->getServices();

        // Split boost vs account services by name keywords
        $boostKeywords   = ['followers', 'likes', 'views', 'comments', 'shares', 'subscribers',
                            'retweets', 'impressions', 'plays', 'streams', 'reposts', 'saves',
                            'reactions', 'story views', 'reel views', 'watch time'];
        $accountKeywords = ['account', 'accounts', 'pva', 'aged', 'verified', 'profile'];

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
        Log::info('smmpanel.order.attempt', compact('serviceId', 'link', 'quantity'));

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
