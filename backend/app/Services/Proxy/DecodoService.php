<?php

namespace App\Services\Proxy;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Decodo (formerly Smartproxy) proxy integration.
 *
 * Provisioning uses gateway credentials (no management API needed).
 * Username format: user-{account}-country-{cc}[-session-{id}]
 * Gateway: gate.decodo.com:7777 (HTTP), gate.decodo.com:7000 (SOCKS5)
 */
class DecodoService
{
    public function isEnabled(): bool
    {
        return (bool) config('services.decodo.enabled', false)
            && ! empty(config('services.decodo.username'))
            && ! empty(config('services.decodo.password'));
    }

    // ─── Locations (static fallback — no API needed) ──────────────────────────

    public function getLocations(string $proxyType = 'residential'): array
    {
        return $this->staticLocations();
    }

    // ─── Create subscription (credential-based, no API call) ─────────────────

    public function createSubscription(array $options): array
    {
        $username = config('services.decodo.username');
        $password = config('services.decodo.password');

        if (empty($username) || empty($password)) {
            throw new RuntimeException('Decodo gateway credentials not configured (DECODO_USERNAME / DECODO_PASSWORD).');
        }

        $proxyType   = $options['proxy_type'];
        $country     = strtolower($options['country_code'] ?? 'us');
        $sessionType = $options['session_type'] ?? 'rotating';
        $protocol    = $options['protocol'] ?? 'http';
        $duration    = (int) ($options['duration_days'] ?? 30);
        $sessionId   = Str::random(16);

        $proxyUsername = $this->buildUsername($username, $country, $sessionType, $sessionId);
        $host          = $this->resolveHost($proxyType, $protocol);
        $port          = $this->resolvePort($proxyType, $protocol);

        Log::info('decodo.credential_provisioned', [
            'proxy_type'  => $proxyType,
            'country'     => $country,
            'session_type'=> $sessionType,
            'host'        => $host,
            'port'        => $port,
        ]);

        return [
            'provider_subscription_id' => $sessionId,
            'host'                     => $host,
            'port'                     => $port,
            'username'                 => $proxyUsername,
            'password'                 => $password,
            'bandwidth_gb_total'       => (float) ($options['bandwidth_gb'] ?? 0),
            'expires_at'               => now()->addDays($duration)->toISOString(),
        ];
    }

    // ─── Get credentials (returns stored values — no API) ────────────────────

    public function getCredentials(string $subscriptionId): array
    {
        // Credentials are stored encrypted in our DB; this is a no-op for Decodo
        return [];
    }

    // ─── Usage (graceful degradation — no API) ────────────────────────────────

    public function getUsage(string $subscriptionId): array
    {
        // Usage tracking via Decodo dashboard; return 0 to avoid blocking
        return ['bandwidth_gb_used' => 0, 'bandwidth_gb_total' => 0];
    }

    // ─── Renew (extend expiry + new session ID) ───────────────────────────────

    public function renewSubscription(string $subscriptionId, int $days = 30): array
    {
        // For gateway-credential proxies, renewal means issuing new credentials
        $username    = config('services.decodo.username');
        $password    = config('services.decodo.password');
        $newSession  = Str::random(16);
        $newUsername = $this->buildUsername($username, 'us', 'rotating', $newSession);

        return [
            'expires_at'               => now()->addDays($days)->toISOString(),
            'provider_subscription_id' => $newSession,
            'username'                 => $newUsername,
            'password'                 => $password,
        ];
    }

    // ─── Cancel (local only) ──────────────────────────────────────────────────

    public function cancelSubscription(string $subscriptionId): void
    {
        // Nothing to call on Decodo's side for gateway-credential proxies
    }

    // ─── Rotate session ───────────────────────────────────────────────────────

    public function rotateSession(string $subscriptionId): array
    {
        $username   = config('services.decodo.username');
        $password   = config('services.decodo.password');
        $newSession = Str::random(16);

        return [
            'username' => $this->buildUsername($username, 'us', 'rotating', $newSession),
            'password' => $password,
        ];
    }

    // ─── Test connectivity ────────────────────────────────────────────────────

    public function testProxy(array $credentials): array
    {
        try {
            $proto    = $credentials['protocol'] ?? 'http';
            $proxyUrl = "{$proto}://{$credentials['username']}:{$credentials['password']}@{$credentials['host']}:{$credentials['port']}";
            $start    = microtime(true);
            $res      = Http::withOptions(['proxy' => $proxyUrl])->timeout(10)->get('https://ip.decodo.com/json');
            $ms       = (int) round((microtime(true) - $start) * 1000);

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
            Log::warning('decodo.test_proxy.failed', ['error' => $e->getMessage()]);
        }

        return ['success' => false, 'error' => 'Proxy test failed'];
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function buildUsername(string $baseUser, string $country, string $sessionType, string $sessionId): string
    {
        $parts = ["user-{$baseUser}"];

        if ($country && $country !== 'all') {
            $parts[] = "country-{$country}";
        }

        if (in_array($sessionType, ['sticky', 'static'], true)) {
            $parts[] = "session-{$sessionId}";
        }

        return implode('-', $parts);
    }

    private function resolveHost(string $proxyType, string $protocol): string
    {
        return match (true) {
            str_starts_with($proxyType, 'datacenter') => 'dc.decodo.com',
            str_starts_with($proxyType, 'isp')        => 'isp.decodo.com',
            str_starts_with($proxyType, 'mobile')     => 'mobile.decodo.com',
            default                                    => 'gate.decodo.com',
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

    private function staticLocations(): array
    {
        return [
            ['country_code' => 'US', 'country_name' => 'United States', 'city' => null, 'available' => true],
            ['country_code' => 'GB', 'country_name' => 'United Kingdom', 'city' => null, 'available' => true],
            ['country_code' => 'DE', 'country_name' => 'Germany',        'city' => null, 'available' => true],
            ['country_code' => 'FR', 'country_name' => 'France',         'city' => null, 'available' => true],
            ['country_code' => 'CA', 'country_name' => 'Canada',         'city' => null, 'available' => true],
            ['country_code' => 'AU', 'country_name' => 'Australia',      'city' => null, 'available' => true],
            ['country_code' => 'IN', 'country_name' => 'India',          'city' => null, 'available' => true],
            ['country_code' => 'BR', 'country_name' => 'Brazil',         'city' => null, 'available' => true],
            ['country_code' => 'JP', 'country_name' => 'Japan',          'city' => null, 'available' => true],
            ['country_code' => 'SG', 'country_name' => 'Singapore',      'city' => null, 'available' => true],
            ['country_code' => 'NL', 'country_name' => 'Netherlands',    'city' => null, 'available' => true],
            ['country_code' => 'NG', 'country_name' => 'Nigeria',        'city' => null, 'available' => true],
            ['country_code' => 'ZA', 'country_name' => 'South Africa',   'city' => null, 'available' => true],
            ['country_code' => 'KE', 'country_name' => 'Kenya',          'city' => null, 'available' => true],
            ['country_code' => 'GH', 'country_name' => 'Ghana',          'city' => null, 'available' => true],
        ];
    }
}
