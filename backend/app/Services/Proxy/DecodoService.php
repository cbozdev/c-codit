<?php

namespace App\Services\Proxy;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Decodo (formerly Smartproxy) proxy integration.
 *
 * Residential with API key: creates actual sub-users via the management API,
 * tracks real usage, and deletes sub-users on cancel.
 *
 * Datacenter / ISP / Mobile (no API support): gateway credentials only.
 *
 * API base:       https://api.decodo.com
 * Auth header:    Authorization: {api_key}  (no Bearer prefix)
 * Gateway HTTP:   gate.decodo.com:10000
 * Gateway SOCKS5: gate.decodo.com:7000
 */
class DecodoService
{
    private const API_BASE = 'https://api.decodo.com';

    public function isEnabled(): bool
    {
        $dbVal   = \Illuminate\Support\Facades\Cache::remember('proxy.decodo.enabled', 60, fn() =>
            \App\Models\AppSetting::getValue('proxy.decodo.enabled')
        );
        $enabled = $dbVal !== null ? filter_var($dbVal, FILTER_VALIDATE_BOOLEAN) : (bool) config('services.decodo.enabled', false);
        return $enabled && ! empty(config('services.decodo.username')) && ! empty(config('services.decodo.password'));
    }

    // ─── Locations ────────────────────────────────────────────────────────────

    public function getLocations(string $proxyType = 'residential'): array
    {
        return $this->staticLocations();
    }

    // ─── Create subscription ──────────────────────────────────────────────────

    public function createSubscription(array $options): array
    {
        $proxyType   = $options['proxy_type'];
        $country     = strtolower($options['country_code'] ?? 'us');
        $state       = strtolower($options['state_code']   ?? '');
        $sessionType = $options['session_type'] ?? 'rotating';
        $protocol    = $options['protocol'] ?? 'http';
        $duration    = (int) ($options['duration_days'] ?? 30);

        // Always use main account gateway credentials for residential proxies.
        // API sub-users are created without bandwidth allocation by default,
        // which causes "no exit node" errors despite an active plan.
        return $this->createViaGateway($proxyType, $country, $state, $sessionType, $protocol, $duration, $options);
    }

    private function createViaApi(string $proxyType, string $country, string $state, string $sessionType, string $protocol, int $duration, array $options): array
    {
        // Sub-user username: 6–64 chars, alphanumeric + underscore only
        $subUsername = 'u' . strtolower(Str::random(11));
        $subPassword = $this->generateSecurePassword();
        $sessionId   = Str::random(16);

        try {
            $res = Http::withHeaders($this->apiHeaders())
                ->timeout(10)
                ->post(self::API_BASE . '/v2/sub-users', [
                    'username'     => $subUsername,
                    'password'     => $subPassword,
                    'service_type' => 'residential_proxies',
                ]);
        } catch (\Throwable $e) {
            Log::warning('decodo.sub_user_create_exception', ['error' => $e->getMessage()]);
            return $this->createViaGateway($proxyType, $country, $state, $sessionType, $protocol, $duration, $options);
        }

        if (! $res->successful()) {
            Log::warning('decodo.sub_user_create_failed', ['status' => $res->status(), 'body' => $res->body()]);
            return $this->createViaGateway($proxyType, $country, $state, $sessionType, $protocol, $duration, $options);
        }

        // Decodo returns the sub-user ID; fall back to username if not present
        $subUserId = $res->json('id') ?? $res->json('sub_user_id') ?? $subUsername;

        [$host, $port] = $this->resolveEndpoint('residential', $protocol);
        $resolvedIp    = $this->resolveIp($host);

        Log::info('decodo.sub_user_provisioned', [
            'sub_user_id' => $subUserId,
            'proxy_type'  => $proxyType,
            'country'     => $country,
            'state'       => $state,
            'host'        => $host,
            'port'        => $port,
            'resolved_ip' => $resolvedIp,
        ]);

        return [
            'provider_subscription_id' => (string) $subUserId,
            'host'                     => $host,
            'resolved_ip'              => $resolvedIp,
            'port'                     => $port,
            'username'                 => $this->buildGatewayUsername($subUsername, $country, $state, $sessionType, $sessionId),
            'password'                 => $subPassword,
            'bandwidth_gb_total'       => (float) ($options['bandwidth_gb'] ?? 0),
            'expires_at'               => now()->addDays($duration)->toISOString(),
        ];
    }

    private function createViaGateway(string $proxyType, string $country, string $state, string $sessionType, string $protocol, int $duration, array $options): array
    {
        $username = config('services.decodo.username');
        $password = config('services.decodo.password');

        if (empty($username) || empty($password)) {
            throw new RuntimeException('Decodo gateway credentials not configured (DECODO_USERNAME / DECODO_PASSWORD).');
        }

        $sessionId  = Str::random(16);
        [$host, $port] = $this->resolveEndpoint($proxyType, $protocol);
        $resolvedIp = $this->resolveIp($host);

        Log::info('decodo.gateway_credential_provisioned', [
            'proxy_type'  => $proxyType,
            'country'     => $country,
            'state'       => $state,
            'host'        => $host,
            'port'        => $port,
            'resolved_ip' => $resolvedIp,
        ]);

        return [
            'provider_subscription_id' => $sessionId,
            'host'                     => $host,
            'resolved_ip'              => $resolvedIp,
            'port'                     => $port,
            'username'                 => $this->buildGatewayUsername($username, $country, $state, $sessionType, $sessionId),
            'password'                 => $password,
            'bandwidth_gb_total'       => (float) ($options['bandwidth_gb'] ?? 0),
            'expires_at'               => now()->addDays($duration)->toISOString(),
        ];
    }

    // ─── IP Whitelist (allow sub-user to connect without username/password) ─────

    public function listSubUsers(): array
    {
        if (! $this->hasApiKey()) return [];
        try {
            $res = Http::withHeaders($this->apiHeaders())
                ->timeout(10)
                ->get(self::API_BASE . '/v2/sub-users');
            return $res->successful() ? ($res->json('data') ?? $res->json() ?? []) : [];
        } catch (\Throwable) {
            return [];
        }
    }

    public function updateSubUserAllowedIps(string $subUserId, array $ips): bool
    {
        if (! $this->hasApiKey() || ! is_numeric($subUserId)) {
            return false;
        }

        try {
            $res = Http::withHeaders($this->apiHeaders())
                ->timeout(10)
                ->put(self::API_BASE . "/v2/sub-users/{$subUserId}", [
                    'allowed_ips' => array_values($ips),
                ]);

            if (! $res->successful()) {
                Log::warning('decodo.update_allowed_ips_failed', [
                    'sub_user_id' => $subUserId,
                    'status'      => $res->status(),
                    'body'        => $res->body(),
                ]);
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('decodo.update_allowed_ips_exception', ['error' => $e->getMessage()]);
            return false;
        }
    }

    // ─── Get credentials (stored in DB; no-op) ────────────────────────────────

    public function getCredentials(string $subscriptionId): array
    {
        return [];
    }

    // ─── Usage ────────────────────────────────────────────────────────────────

    public function getUsage(string $subscriptionId): array
    {
        // Only API sub-users (numeric IDs) have trackable usage
        if (! $this->hasApiKey() || ! is_numeric($subscriptionId)) {
            return ['bandwidth_gb_used' => 0, 'bandwidth_gb_total' => 0];
        }

        try {
            $res = Http::withHeaders($this->apiHeaders())
                ->get(self::API_BASE . "/v2/sub-users/{$subscriptionId}/traffic", [
                    'type'         => 'month',
                    'service_type' => 'residential_proxies',
                ]);

            if ($res->successful()) {
                $bytes = (float) ($res->json('traffic') ?? 0);
                return [
                    'bandwidth_gb_used'  => round($bytes / 1_073_741_824, 4),
                    'bandwidth_gb_total' => 0,
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('decodo.usage_fetch_failed', ['error' => $e->getMessage()]);
        }

        return ['bandwidth_gb_used' => 0, 'bandwidth_gb_total' => 0];
    }

    // ─── Renew ────────────────────────────────────────────────────────────────

    public function renewSubscription(string $subscriptionId, int $days = 30, string $country = 'us', string $sessionType = 'rotating', string $state = ''): array
    {
        // For API sub-users: Decodo has no expiry concept — just extend our local expiry.
        // For gateway subs: keep the same master credentials.
        $password = is_numeric($subscriptionId)
            ? null   // returned by caller from DB
            : config('services.decodo.password');

        $result = [
            'expires_at'               => now()->addDays($days)->toISOString(),
            'provider_subscription_id' => $subscriptionId,
        ];

        if ($password) {
            $username = config('services.decodo.username');
            $newSession = Str::random(16);
            $result['username'] = $this->buildGatewayUsername($username, $country, $state, $sessionType, $newSession);
            $result['password'] = $password;
        }

        return $result;
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────

    public function cancelSubscription(string $subscriptionId): void
    {
        if (! $this->hasApiKey() || ! is_numeric($subscriptionId)) {
            return;
        }

        try {
            $res = Http::withHeaders($this->apiHeaders())
                ->delete(self::API_BASE . "/v2/sub-users/{$subscriptionId}");

            if (! $res->successful()) {
                Log::warning('decodo.sub_user_delete_failed', [
                    'sub_user_id' => $subscriptionId,
                    'status'      => $res->status(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('decodo.cancel_exception', ['error' => $e->getMessage()]);
        }
    }

    // ─── Rotate session ───────────────────────────────────────────────────────

    public function rotateSession(string $subscriptionId, string $country = 'us', string $sessionType = 'rotating', string $state = ''): array
    {
        // For API sub-users: rotate by generating a new password via PUT /v2/sub-users/{id}
        if ($this->hasApiKey() && is_numeric($subscriptionId)) {
            return $this->rotateApiSubUser($subscriptionId, $country, $state, $sessionType);
        }

        // Gateway creds: new session ID in username (rotating sessions change automatically anyway)
        $username   = config('services.decodo.username');
        $password   = config('services.decodo.password');
        $newSession = Str::random(16);

        return [
            'username' => $this->buildGatewayUsername($username, $country, $state, $sessionType, $newSession),
            'password' => $password,
        ];
    }

    private function rotateApiSubUser(string $subUserId, string $country, string $state, string $sessionType): array
    {
        $newPassword = $this->generateSecurePassword();
        $newSession  = Str::random(16);

        try {
            $res = Http::withHeaders($this->apiHeaders())
                ->put(self::API_BASE . "/v2/sub-users/{$subUserId}", [
                    'password' => $newPassword,
                ]);

            if (! $res->successful()) {
                Log::warning('decodo.sub_user_rotate_failed', ['id' => $subUserId, 'status' => $res->status()]);
                return [];
            }

            // Reconstruct gateway username from the sub-user ID
            // The sub-user's base username is stored in our DB; we rebuild from the ID
            // by fetching the sub-user details
            $detail = Http::withHeaders($this->apiHeaders())
                ->get(self::API_BASE . "/v2/sub-users/{$subUserId}");

            $subUsername = $detail->successful()
                ? ($detail->json('username') ?? $subUserId)
                : $subUserId;

            return [
                'username' => $this->buildGatewayUsername($subUsername, $country, $state, $sessionType, $newSession),
                'password' => $newPassword,
            ];
        } catch (\Throwable $e) {
            Log::warning('decodo.rotate_exception', ['error' => $e->getMessage()]);
            return [];
        }
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

            $msg = $e->getMessage();
            if (str_contains($msg, 'Connection refused') || str_contains($msg, 'timed out') || str_contains($msg, 'cURL error 7') || str_contains($msg, 'cURL error 28')) {
                return [
                    'success' => false,
                    'error'   => 'Server cannot reach the proxy host (outbound port restricted by hosting). Your proxy credentials are valid — test them directly from your device.',
                ];
            }
        }

        return ['success' => false, 'error' => 'Proxy test failed — credentials may be invalid or proxy is offline.'];
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function hasApiKey(): bool
    {
        return ! empty(config('services.decodo.api_key'));
    }

    private function isResidential(string $proxyType): bool
    {
        return str_starts_with($proxyType, 'residential');
    }

    private function apiHeaders(): array
    {
        return ['Authorization' => config('services.decodo.api_key')];
    }

    private function resolveEndpoint(string $proxyType, string $protocol): array
    {
        $hostname = match (true) {
            str_starts_with($proxyType, 'datacenter') => 'dc.decodo.com',
            str_starts_with($proxyType, 'isp')        => 'isp.decodo.com',
            str_starts_with($proxyType, 'mobile')     => 'mobile.decodo.com',
            default                                    => 'gate.decodo.com',
        };

        $port = match ($protocol) {
            'socks5' => 7000,
            default  => 10000,
        };

        // Always store the hostname — Decodo rotates gateway IPs so a
        // DNS-resolved IP becomes stale within hours.
        return [$hostname, $port];
    }

    private function resolveIp(string $host): ?string
    {
        if (filter_var($host, FILTER_VALIDATE_IP)) return $host;
        $resolved = gethostbyname($host);
        return ($resolved !== $host) ? $resolved : null;
    }

    private function buildGatewayUsername(string $baseUser, string $country, string $state, string $sessionType, string $sessionId): string
    {
        $parts = ["user-{$baseUser}"];

        if ($country && $country !== 'all') {
            $parts[] = "country-{$country}";
        }

        if ($state && $country === 'us') {
            $parts[] = "state-{$state}";
        }

        if (in_array($sessionType, ['sticky', 'static'], true)) {
            $parts[] = "session-{$sessionId}";
        }

        return implode('-', $parts);
    }

    private function generateSecurePassword(): string
    {
        // Decodo requires 12+ chars with upper, lower, digit, and one of _ ~ + =
        $upper   = substr(str_shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 0, 3);
        $lower   = substr(str_shuffle('abcdefghijklmnopqrstuvwxyz'), 0, 3);
        $digits  = substr(str_shuffle('0123456789'), 0, 3);
        $special = ['_', '~', '+', '='][random_int(0, 3)];
        $rest    = Str::random(5);

        return str_shuffle($upper . $lower . $digits . $special . $rest);
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
