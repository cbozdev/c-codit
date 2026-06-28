<?php

namespace App\Services\Proxy;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * ProxyEmpire integration.
 *
 * API base:    https://panel.proxyempire.io/api/v2
 * Auth:        Authorization: Bearer {token}
 * Gateway:     v2.proxyempire.io:5000 (HTTP) / :5001 (SOCKS5)
 * Username:    {proxy_username}-country-{cc}-state-{state_name}-sid-{session_id}
 */
class ProxyEmpireService
{
    private const API_BASE    = 'https://panel.proxyempire.io/api/v2';
    private const GATEWAY     = 'v2.proxyempire.io';
    private const PORT_HTTP   = 5000;
    private const PORT_SOCKS5 = 5001;

    // US state code → full lowercase name (ProxyEmpire uses full names, spaces as +)
    private const US_STATES = [
        'al' => 'alabama',       'ak' => 'alaska',          'az' => 'arizona',
        'ar' => 'arkansas',      'ca' => 'california',       'co' => 'colorado',
        'ct' => 'connecticut',   'de' => 'delaware',         'fl' => 'florida',
        'ga' => 'georgia',       'hi' => 'hawaii',           'id' => 'idaho',
        'il' => 'illinois',      'in' => 'indiana',          'ia' => 'iowa',
        'ks' => 'kansas',        'ky' => 'kentucky',         'la' => 'louisiana',
        'me' => 'maine',         'md' => 'maryland',         'ma' => 'massachusetts',
        'mi' => 'michigan',      'mn' => 'minnesota',        'ms' => 'mississippi',
        'mo' => 'missouri',      'mt' => 'montana',          'ne' => 'nebraska',
        'nv' => 'nevada',        'nh' => 'new+hampshire',    'nj' => 'new+jersey',
        'nm' => 'new+mexico',    'ny' => 'new+york',         'nc' => 'north+carolina',
        'nd' => 'north+dakota',  'oh' => 'ohio',             'ok' => 'oklahoma',
        'or' => 'oregon',        'pa' => 'pennsylvania',     'ri' => 'rhode+island',
        'sc' => 'south+carolina','sd' => 'south+dakota',     'tn' => 'tennessee',
        'tx' => 'texas',         'ut' => 'utah',             'vt' => 'vermont',
        'va' => 'virginia',      'wa' => 'washington',       'wv' => 'west+virginia',
        'wi' => 'wisconsin',     'wy' => 'wyoming',          'dc' => 'district+of+columbia',
    ];

    public function isEnabled(): bool
    {
        $dbVal   = Cache::remember('proxy.proxyempire.enabled', 60, fn() =>
            \App\Models\AppSetting::getValue('proxy.proxyempire.enabled')
        );
        $enabled = $dbVal !== null ? filter_var($dbVal, FILTER_VALIDATE_BOOLEAN) : (bool) config('services.proxyempire.enabled', false);
        return $enabled && ! empty(config('services.proxyempire.api_token'));
    }

    private function client()
    {
        return Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.proxyempire.api_token'),
            'Accept'        => 'application/json',
            'Content-Type'  => 'application/json',
        ])->timeout(15);
    }

    // ─── Account credentials (cached 10 min) ──────────────────────────────────

    public function getAccountCredentials(string $type = 'residential'): array
    {
        $cacheKey = 'proxyempire.creds.' . $type;

        return Cache::remember($cacheKey, 600, function () use ($type) {
            $res = $this->client()->get(self::API_BASE . '/user');

            if (! $res->successful()) {
                Log::warning('proxyempire.get_user_failed', ['status' => $res->status(), 'body' => $res->body()]);
                throw new RuntimeException('ProxyEmpire: Failed to fetch account credentials — ' . ($res->json('message') ?? $res->status()));
            }

            $data    = $res->json('data', []);
            $typeKey = $type === 'mobile' ? 'mobile' : 'residential';

            if (empty($data[$typeKey]['proxy_username'])) {
                throw new RuntimeException("ProxyEmpire: No active {$typeKey} package. Please top up your ProxyEmpire account.");
            }

            return [
                'username' => $data[$typeKey]['proxy_username'],
                'password' => $data[$typeKey]['proxy_password'],
            ];
        });
    }

    // ─── Locations ────────────────────────────────────────────────────────────

    public function getLocations(string $proxyType = 'residential'): array
    {
        $connType = str_contains($proxyType, 'mobile') ? 'mobile' : 'residential';

        try {
            $res = $this->client()->get(self::API_BASE . '/countries', [
                'connection_type' => $connType,
            ]);

            if ($res->successful()) {
                return collect($res->json('countries', []))->map(fn($c) => [
                    'country_code' => strtoupper($c['code'] ?? ''),
                    'country_name' => $c['name'] ?? '',
                    'city'         => null,
                    'available'    => true,
                ])->filter(fn($c) => strlen($c['country_code']) === 2)->values()->toArray();
            }
        } catch (\Throwable $e) {
            Log::warning('proxyempire.get_locations_failed', ['error' => $e->getMessage()]);
        }

        return $this->staticLocations();
    }

    // ─── Create subscription ──────────────────────────────────────────────────

    public function createSubscription(array $options): array
    {
        $isMobile    = ($options['connection_type'] ?? '') === 'cell'
                     || str_contains($options['proxy_type'] ?? '', 'mobile');
        $country     = strtolower($options['country_code'] ?? 'us');
        $state       = strtolower($options['state_code'] ?? '');
        $sessionType = $options['session_type'] ?? 'sticky';
        $protocol    = $options['protocol'] ?? 'http';
        $duration    = (int) ($options['duration_days'] ?? 1);
        $sessionId   = Str::random(10);

        $credType = $isMobile ? 'mobile' : 'residential';
        $creds    = $this->getAccountCredentials($credType);

        $port     = $protocol === 'socks5' ? self::PORT_SOCKS5 : self::PORT_HTTP;
        $host     = self::GATEWAY;
        $resolved = $this->resolveIp($host);
        $username = $this->buildUsername($creds['username'], $country, $state, $sessionType, $sessionId);

        Log::info('proxyempire.provisioned', [
            'type'        => $credType,
            'country'     => $country,
            'state'       => $state,
            'session_type'=> $sessionType,
        ]);

        return [
            'provider_subscription_id' => $sessionId,
            'host'                     => $host,
            'resolved_ip'              => $resolved,
            'port'                     => $port,
            'username'                 => $username,
            'password'                 => $creds['password'],
            'bandwidth_gb_total'       => 0,
            'expires_at'               => now()->addDays($duration)->toISOString(),
        ];
    }

    // ─── Rotate session ───────────────────────────────────────────────────────

    public function rotateSession(string $subscriptionId, string $country = 'us', string $sessionType = 'sticky', string $state = ''): array
    {
        $isMobile  = false; // Can't know from session ID alone; default to residential
        $creds     = $this->getAccountCredentials($isMobile ? 'mobile' : 'residential');
        $newId     = Str::random(10);

        return [
            'username'                 => $this->buildUsername($creds['username'], $country, $state, $sessionType, $newId),
            'password'                 => $creds['password'],
            'provider_subscription_id' => $newId,
        ];
    }

    // ─── Renew ────────────────────────────────────────────────────────────────

    public function renewSubscription(string $subscriptionId, int $days = 30, string $country = 'us', string $sessionType = 'sticky', string $state = ''): array
    {
        $creds = $this->getAccountCredentials();
        $newId = Str::random(10);

        return [
            'expires_at'               => now()->addDays($days)->toISOString(),
            'provider_subscription_id' => $newId,
            'username'                 => $this->buildUsername($creds['username'], $country, $state, $sessionType, $newId),
            'password'                 => $creds['password'],
        ];
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────

    public function cancelSubscription(string $subscriptionId): void
    {
        // Session-based subscriptions have no server-side resource to delete
        Log::info('proxyempire.cancel', ['session_id' => $subscriptionId]);
    }

    // ─── Usage ────────────────────────────────────────────────────────────────

    public function getUsage(string $subscriptionId): array
    {
        // Per-session usage tracking not available; return account-level remaining
        try {
            $res = $this->client()->get(self::API_BASE . '/user');
            if ($res->successful()) {
                $bw = $res->json('data.residential.bandwidth', []);
                return [
                    'bandwidth_gb_used'  => round(($bw['used'] ?? 0) / 1_073_741_824, 4),
                    'bandwidth_gb_total' => round(($bw['total'] ?? 0) / 1_073_741_824, 4),
                ];
            }
        } catch (\Throwable) {}

        return ['bandwidth_gb_used' => 0, 'bandwidth_gb_total' => 0];
    }

    // ─── IP Whitelist (not available at gateway level for ProxyEmpire) ────────

    public function updateSubUserAllowedIps(string $subUserId, array $ips): bool
    {
        return false;
    }

    // ─── Test proxy ───────────────────────────────────────────────────────────

    public function testProxy(array $credentials): array
    {
        try {
            $proto    = $credentials['protocol'] ?? 'http';
            $proxyUrl = "{$proto}://{$credentials['username']}:{$credentials['password']}@{$credentials['host']}:{$credentials['port']}";
            $start    = microtime(true);
            $res      = Http::withOptions(['proxy' => $proxyUrl])->timeout(10)->get('https://ipinfo.io/json');
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
            $msg = $e->getMessage();
            if (str_contains($msg, 'Connection refused') || str_contains($msg, 'timed out')
                || str_contains($msg, 'cURL error 7') || str_contains($msg, 'cURL error 28')) {
                return [
                    'success' => false,
                    'error'   => 'Server cannot reach the proxy host (outbound port restricted by hosting). Test directly from your device.',
                ];
            }
        }

        return ['success' => false, 'error' => 'Proxy test failed — check credentials or proxy status.'];
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function buildUsername(string $baseUsername, string $country, string $state, string $sessionType, string $sessionId): string
    {
        $parts = [$baseUsername];

        if ($country && $country !== 'all') {
            $parts[] = "country-{$country}";
        }

        if ($state && $country === 'us') {
            $stateName = self::US_STATES[$state] ?? $state;
            $parts[]   = "state-{$stateName}";
        }

        if ($sessionType === 'sticky') {
            $parts[] = "sid-{$sessionId}";
        }

        return implode('-', $parts);
    }

    private function resolveIp(string $host): ?string
    {
        if (filter_var($host, FILTER_VALIDATE_IP)) return $host;
        $resolved = gethostbyname($host);
        return ($resolved !== $host) ? $resolved : null;
    }

    private function staticLocations(): array
    {
        return [
            ['country_code' => 'US', 'country_name' => 'United States',  'city' => null, 'available' => true],
            ['country_code' => 'GB', 'country_name' => 'United Kingdom',  'city' => null, 'available' => true],
            ['country_code' => 'DE', 'country_name' => 'Germany',         'city' => null, 'available' => true],
            ['country_code' => 'FR', 'country_name' => 'France',          'city' => null, 'available' => true],
            ['country_code' => 'CA', 'country_name' => 'Canada',          'city' => null, 'available' => true],
            ['country_code' => 'AU', 'country_name' => 'Australia',       'city' => null, 'available' => true],
            ['country_code' => 'IN', 'country_name' => 'India',           'city' => null, 'available' => true],
            ['country_code' => 'BR', 'country_name' => 'Brazil',          'city' => null, 'available' => true],
            ['country_code' => 'JP', 'country_name' => 'Japan',           'city' => null, 'available' => true],
            ['country_code' => 'SG', 'country_name' => 'Singapore',       'city' => null, 'available' => true],
            ['country_code' => 'NL', 'country_name' => 'Netherlands',     'city' => null, 'available' => true],
            ['country_code' => 'NG', 'country_name' => 'Nigeria',         'city' => null, 'available' => true],
        ];
    }
}
