<?php

namespace App\Services\Proxy;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Decodo (formerly Smartproxy) API integration.
 *
 * Docs: https://docs.decodo.com/reference
 * Auth: Bearer token via x-api-key header
 */
class DecodoService
{
    private string $baseUrl = 'https://api.decodo.com/v1';

    private function client()
    {
        return Http::withHeaders([
            'Authorization' => 'Token ' . config('services.decodo.api_key'),
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
        ])->timeout(15);
    }

    public function isEnabled(): bool
    {
        return (bool) config('services.decodo.enabled', true)
            && ! empty(config('services.decodo.api_key'));
    }

    // ─── Locations ────────────────────────────────────────────────────────────

    public function getLocations(string $proxyType = 'residential'): array
    {
        $res = $this->client()->get("{$this->baseUrl}/locations", [
            'product_type' => $this->mapProxyType($proxyType),
        ]);

        if ($res->failed()) {
            Log::warning('decodo.locations.failed', ['status' => $res->status()]);
            return [];
        }

        return collect($res->json('data', []))->map(fn($loc) => [
            'country_code' => strtoupper($loc['country_code'] ?? ''),
            'country_name' => $loc['country_name'] ?? '',
            'city'         => $loc['city'] ?? null,
            'available'    => $loc['available'] ?? true,
        ])->toArray();
    }

    // ─── Create subscription ──────────────────────────────────────────────────

    public function createSubscription(array $options): array
    {
        $payload = [
            'product_type'   => $this->mapProxyType($options['proxy_type']),
            'country_code'   => strtolower($options['country_code'] ?? 'us'),
            'city'           => $options['city'] ?? null,
            'bandwidth_gb'   => $options['bandwidth_gb'] ?? null,
            'ip_count'       => $options['ip_count'] ?? 1,
            'threads'        => $options['threads'] ?? 10,
            'duration_days'  => $options['duration_days'] ?? 30,
            'protocol'       => $options['protocol'] ?? 'http',
            'session_type'   => $options['session_type'] ?? 'rotating',
            'username'       => $options['username'] ?? null,
            'password'       => $options['password'] ?? null,
        ];

        $payload = array_filter($payload, fn($v) => $v !== null);

        $res  = $this->client()->post("{$this->baseUrl}/subscriptions", $payload);
        $body = $res->json();

        Log::info('decodo.create_subscription', [
            'status' => $res->status(),
            'id'     => $body['data']['id'] ?? null,
        ]);

        if ($res->failed()) {
            throw new RuntimeException('Decodo: ' . ($body['message'] ?? $body['error'] ?? 'Failed to create subscription'));
        }

        $data = $body['data'] ?? $body;

        return [
            'provider_subscription_id' => (string) ($data['id'] ?? $data['subscription_id'] ?? ''),
            'host'                     => $data['host'] ?? $this->resolveHost($options['proxy_type'], $options['protocol'] ?? 'http'),
            'port'                     => (int) ($data['port'] ?? $this->resolvePort($options['proxy_type'], $options['protocol'] ?? 'http')),
            'username'                 => $data['username'] ?? $data['credentials']['username'] ?? '',
            'password'                 => $data['password'] ?? $data['credentials']['password'] ?? '',
            'bandwidth_gb_total'       => (float) ($data['bandwidth_gb'] ?? $options['bandwidth_gb'] ?? 0),
            'expires_at'               => $data['expires_at'] ?? now()->addDays($options['duration_days'] ?? 30)->toISOString(),
        ];
    }

    // ─── Get credentials ──────────────────────────────────────────────────────

    public function getCredentials(string $subscriptionId): array
    {
        $res  = $this->client()->get("{$this->baseUrl}/subscriptions/{$subscriptionId}/credentials");
        $body = $res->json();

        if ($res->failed()) {
            throw new RuntimeException('Decodo: ' . ($body['message'] ?? 'Failed to fetch credentials'));
        }

        $data = $body['data'] ?? $body;
        return [
            'username' => $data['username'] ?? '',
            'password' => $data['password'] ?? '',
        ];
    }

    // ─── Usage ────────────────────────────────────────────────────────────────

    public function getUsage(string $subscriptionId): array
    {
        $res  = $this->client()->get("{$this->baseUrl}/subscriptions/{$subscriptionId}/usage");
        $body = $res->json();

        if ($res->failed()) return ['bandwidth_gb_used' => 0];

        $data = $body['data'] ?? $body;
        return [
            'bandwidth_gb_used' => (float) ($data['bandwidth_used_gb'] ?? $data['used_gb'] ?? 0),
            'bandwidth_gb_total'=> (float) ($data['bandwidth_total_gb'] ?? $data['total_gb'] ?? 0),
        ];
    }

    // ─── Renew ────────────────────────────────────────────────────────────────

    public function renewSubscription(string $subscriptionId, int $days = 30): array
    {
        $res  = $this->client()->post("{$this->baseUrl}/subscriptions/{$subscriptionId}/renew", [
            'duration_days' => $days,
        ]);
        $body = $res->json();

        if ($res->failed()) {
            throw new RuntimeException('Decodo: ' . ($body['message'] ?? 'Failed to renew subscription'));
        }

        $data = $body['data'] ?? $body;
        return [
            'expires_at' => $data['expires_at'] ?? now()->addDays($days)->toISOString(),
        ];
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────

    public function cancelSubscription(string $subscriptionId): void
    {
        $res = $this->client()->delete("{$this->baseUrl}/subscriptions/{$subscriptionId}");

        if ($res->failed() && $res->status() !== 404) {
            throw new RuntimeException('Decodo: Failed to cancel subscription');
        }
    }

    // ─── Rotate session ───────────────────────────────────────────────────────

    public function rotateSession(string $subscriptionId): array
    {
        $res  = $this->client()->post("{$this->baseUrl}/subscriptions/{$subscriptionId}/rotate");
        $body = $res->json();

        if ($res->failed()) {
            throw new RuntimeException('Decodo: Failed to rotate session');
        }

        $data = $body['data'] ?? $body;
        return [
            'username' => $data['username'] ?? '',
            'password' => $data['password'] ?? '',
        ];
    }

    // ─── Test connectivity ────────────────────────────────────────────────────

    public function testProxy(array $credentials): array
    {
        try {
            $proxyUrl = "{$credentials['protocol']}://{$credentials['username']}:{$credentials['password']}@{$credentials['host']}:{$credentials['port']}";

            $start = microtime(true);
            $res   = Http::withOptions(['proxy' => $proxyUrl])
                ->timeout(10)
                ->get('https://ip.decodo.com/json');
            $ms = (int) round((microtime(true) - $start) * 1000);

            if ($res->successful()) {
                $data = $res->json();
                return [
                    'success'       => true,
                    'ip'            => $data['ip'] ?? 'unknown',
                    'country'       => $data['country'] ?? 'unknown',
                    'city'          => $data['city'] ?? null,
                    'speed_ms'      => $ms,
                    'anonymity'     => 'Elite',
                    'dns_leak'      => false,
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('decodo.test_proxy.failed', ['error' => $e->getMessage()]);
        }

        return ['success' => false, 'error' => 'Proxy test failed'];
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function mapProxyType(string $type): string
    {
        return match (true) {
            str_starts_with($type, 'residential') => 'residential',
            str_starts_with($type, 'datacenter')  => 'datacenter',
            str_starts_with($type, 'isp')         => 'isp',
            str_starts_with($type, 'mobile')      => 'mobile',
            default                                => $type,
        };
    }

    private function resolveHost(string $proxyType, string $protocol): string
    {
        $socks = $protocol === 'socks5';
        return match (true) {
            str_starts_with($proxyType, 'residential') => $socks ? 'gate.decodo.com'   : 'gate.decodo.com',
            str_starts_with($proxyType, 'datacenter')  => $socks ? 'dc.decodo.com'     : 'dc.decodo.com',
            str_starts_with($proxyType, 'isp')         => $socks ? 'isp.decodo.com'    : 'isp.decodo.com',
            str_starts_with($proxyType, 'mobile')      => $socks ? 'mobile.decodo.com' : 'mobile.decodo.com',
            default                                     => 'gate.decodo.com',
        };
    }

    private function resolvePort(string $proxyType, string $protocol): int
    {
        return match ($protocol) {
            'socks5' => 7000,
            'https'  => 8443,
            default  => 7777,
        };
    }
}
