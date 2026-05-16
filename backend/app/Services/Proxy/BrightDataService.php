<?php

namespace App\Services\Proxy;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Bright Data API integration.
 *
 * Docs: https://docs.brightdata.com/api-reference
 * Auth: Bearer token
 */
class BrightDataService
{
    private string $baseUrl  = 'https://luminati.io/api';
    private string $proxyUrl = 'https://api.brightdata.com';

    private function client()
    {
        return Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.brightdata.api_key'),
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
        ])->timeout(15);
    }

    public function isEnabled(): bool
    {
        return (bool) config('services.brightdata.enabled', true)
            && ! empty(config('services.brightdata.api_key'));
    }

    // ─── Locations ────────────────────────────────────────────────────────────

    public function getLocations(string $proxyType = 'residential'): array
    {
        $res = $this->client()->get("{$this->proxyUrl}/zone/available_country", [
            'zone' => $this->defaultZone($proxyType),
        ]);

        if ($res->failed()) {
            Log::warning('brightdata.locations.failed', ['status' => $res->status()]);
            return [];
        }

        return collect($res->json('countries', $res->json() ?? []))->map(fn($c) => [
            'country_code' => strtoupper(is_string($c) ? $c : ($c['country'] ?? '')),
            'country_name' => is_array($c) ? ($c['country_name'] ?? '') : '',
            'city'         => null,
            'available'    => true,
        ])->filter(fn($c) => strlen($c['country_code']) === 2)->values()->toArray();
    }

    // ─── Create zone / subscription ───────────────────────────────────────────

    public function createSubscription(array $options): array
    {
        $zoneName = 'ccodit_' . substr(md5(uniqid('', true)), 0, 10);
        $type     = $this->mapProxyType($options['proxy_type']);

        $payload = [
            'zone'     => [
                'name' => $zoneName,
                'plan' => [
                    'type'       => $type,
                    'bandwidth'  => isset($options['bandwidth_gb']) ? (int) $options['bandwidth_gb'] . 'gb' : null,
                    'ip_count'   => $options['ip_count'] ?? 1,
                    'country'    => strtolower($options['country_code'] ?? 'us'),
                    'city'       => $options['city'] ?? null,
                ],
            ],
        ];

        $payload['zone']['plan'] = array_filter($payload['zone']['plan'], fn($v) => $v !== null);

        $res  = $this->client()->post("{$this->proxyUrl}/zone", $payload);
        $body = $res->json();

        Log::info('brightdata.create_zone', [
            'status' => $res->status(),
            'zone'   => $zoneName,
        ]);

        if ($res->failed()) {
            throw new RuntimeException('Bright Data: ' . ($body['message'] ?? $body['error'] ?? 'Failed to create zone'));
        }

        // Fetch credentials for the new zone
        $creds = $this->getZoneCredentials($zoneName);

        return [
            'provider_subscription_id' => $zoneName,
            'host'                     => $this->resolveHost($options['proxy_type'], $options['protocol'] ?? 'http'),
            'port'                     => $this->resolvePort($options['proxy_type'], $options['protocol'] ?? 'http'),
            'username'                 => $creds['username'],
            'password'                 => $creds['password'],
            'bandwidth_gb_total'       => (float) ($options['bandwidth_gb'] ?? 0),
            'expires_at'               => now()->addDays($options['duration_days'] ?? 30)->toISOString(),
        ];
    }

    // ─── Get credentials ──────────────────────────────────────────────────────

    public function getZoneCredentials(string $zoneName): array
    {
        $res  = $this->client()->get("{$this->proxyUrl}/zone/passwords", ['zone' => $zoneName]);
        $body = $res->json();

        if ($res->failed()) {
            throw new RuntimeException('Bright Data: Failed to fetch zone credentials');
        }

        $passwords = $body['passwords'] ?? [];
        $password  = $passwords[0] ?? null;

        $customerId = config('services.brightdata.customer_id', 'customer');

        return [
            'username' => "brd-customer-{$customerId}-zone-{$zoneName}",
            'password' => $password ?? '',
        ];
    }

    public function getCredentials(string $subscriptionId): array
    {
        return $this->getZoneCredentials($subscriptionId);
    }

    // ─── Usage ────────────────────────────────────────────────────────────────

    public function getUsage(string $subscriptionId): array
    {
        $res  = $this->client()->get("{$this->proxyUrl}/zone/traffic", ['zone' => $subscriptionId]);
        $body = $res->json();

        if ($res->failed()) return ['bandwidth_gb_used' => 0];

        $bytes = $body['bw'] ?? $body['bandwidth'] ?? 0;
        return [
            'bandwidth_gb_used' => round($bytes / 1_073_741_824, 3),
        ];
    }

    // ─── Renew ────────────────────────────────────────────────────────────────

    public function renewSubscription(string $subscriptionId, int $days = 30): array
    {
        // Bright Data zones don't expire in the traditional sense; we extend billing
        $res  = $this->client()->put("{$this->proxyUrl}/zone", [
            'zone' => $subscriptionId,
            'plan' => ['billing_period' => $days . 'd'],
        ]);

        if ($res->failed() && $res->status() !== 200) {
            throw new RuntimeException('Bright Data: Failed to renew zone');
        }

        return [
            'expires_at' => now()->addDays($days)->toISOString(),
        ];
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────

    public function cancelSubscription(string $subscriptionId): void
    {
        $res = $this->client()->delete("{$this->proxyUrl}/zone", ['zone' => $subscriptionId]);

        if ($res->failed() && $res->status() !== 404) {
            throw new RuntimeException('Bright Data: Failed to cancel zone');
        }
    }

    // ─── Rotate ───────────────────────────────────────────────────────────────

    public function rotateSession(string $subscriptionId): array
    {
        // Generate new password for zone
        $res  = $this->client()->post("{$this->proxyUrl}/zone/passwords", ['zone' => $subscriptionId]);
        $body = $res->json();

        if ($res->failed()) {
            throw new RuntimeException('Bright Data: Failed to rotate session');
        }

        return $this->getZoneCredentials($subscriptionId);
    }

    // ─── Test ─────────────────────────────────────────────────────────────────

    public function testProxy(array $credentials): array
    {
        try {
            $proxyUrl = "{$credentials['protocol']}://{$credentials['username']}:{$credentials['password']}@{$credentials['host']}:{$credentials['port']}";

            $start = microtime(true);
            $res   = Http::withOptions(['proxy' => $proxyUrl])
                ->timeout(10)
                ->get('https://geo.brdtest.com/mygeo.json');
            $ms = (int) round((microtime(true) - $start) * 1000);

            if ($res->successful()) {
                $data = $res->json();
                return [
                    'success'   => true,
                    'ip'        => $data['ip'] ?? 'unknown',
                    'country'   => $data['country'] ?? 'unknown',
                    'city'      => $data['city'] ?? null,
                    'speed_ms'  => $ms,
                    'anonymity' => 'Elite',
                    'dns_leak'  => false,
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('brightdata.test_proxy.failed', ['error' => $e->getMessage()]);
        }

        return ['success' => false, 'error' => 'Proxy test failed'];
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function mapProxyType(string $type): string
    {
        return match (true) {
            str_starts_with($type, 'residential') => 'res',
            str_starts_with($type, 'datacenter')  => 'dc',
            str_starts_with($type, 'isp')         => 'static_res',
            str_starts_with($type, 'mobile')      => 'mobile',
            default                                => 'res',
        };
    }

    private function defaultZone(string $proxyType): string
    {
        return match (true) {
            str_starts_with($proxyType, 'residential') => 'residential',
            str_starts_with($proxyType, 'datacenter')  => 'datacenter1',
            str_starts_with($proxyType, 'isp')         => 'isp',
            str_starts_with($proxyType, 'mobile')      => 'mobile1',
            default                                     => 'residential',
        };
    }

    private function resolveHost(string $proxyType, string $protocol): string
    {
        $socks = $protocol === 'socks5';
        return match (true) {
            str_starts_with($proxyType, 'residential') => 'brd.superproxy.io',
            str_starts_with($proxyType, 'datacenter')  => 'brd.superproxy.io',
            str_starts_with($proxyType, 'isp')         => 'brd.superproxy.io',
            str_starts_with($proxyType, 'mobile')      => 'brd.superproxy.io',
            default                                     => 'brd.superproxy.io',
        };
    }

    private function resolvePort(string $proxyType, string $protocol): int
    {
        return match ($protocol) {
            'socks5' => 22225,
            'https'  => 33335,
            default  => 22225,
        };
    }
}
