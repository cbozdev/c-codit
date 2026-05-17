<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ProxyApiKey;
use App\Models\ProxySubscription;
use App\Models\ProxyTrial;
use App\Models\Service;
use App\Services\Proxy\BrightDataService;
use App\Services\Proxy\DecodoService;
use App\Services\Proxy\ProxyProvisioningService;
use App\Services\Proxy\ProxyRoutingEngine;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProxyController extends Controller
{
    public function __construct(
        private readonly ProxyProvisioningService $provisioning,
        private readonly ProxyRoutingEngine       $routing,
        private readonly DecodoService            $decodo,
        private readonly BrightDataService        $brightData,
    ) {}

    // ─── Catalog ──────────────────────────────────────────────────────────────

    public function plans()
    {
        $services = Service::where('category', 'proxy')->where('is_active', true)->get();

        $plans = $services->map(function ($svc) {
            $config = $svc->config ?? [];
            return [
                'code'          => $svc->code,
                'name'          => $svc->name,
                'description'   => $svc->description,
                'proxy_type'    => $config['proxy_type'] ?? '',
                'subtypes'      => $config['subtypes'] ?? [],
                'protocols'     => $config['protocols'] ?? ['http'],
                'bandwidths'    => $config['bandwidths'] ?? null,
                'ip_packages'   => $config['ip_packages'] ?? null,
                'price_per_gb'  => isset($config['price_per_gb'])
                    ? round($config['price_per_gb'] * (1 + ($svc->markup_percent / 100)) / 100, 2)
                    : null,
                'price_per_ip'  => isset($config['price_per_ip'])
                    ? round($config['price_per_ip'] * (1 + ($svc->markup_percent / 100)) / 100, 2)
                    : null,
                'price_dedicated'=> isset($config['price_dedicated'])
                    ? round($config['price_dedicated'] * (1 + ($svc->markup_percent / 100)) / 100, 2)
                    : null,
                'max_threads'   => $config['max_threads'] ?? 100,
                'trial_gb'      => $config['trial_gb'] ?? null,
            ];
        });

        return ApiResponse::ok($plans);
    }

    public function locations(Request $request)
    {
        $request->validate(['proxy_type' => ['nullable', 'string']]);
        $proxyType = $request->input('proxy_type', 'residential');

        // Try primary provider, fall back to secondary
        $locations = [];
        try {
            $provider  = $this->routing->selectProvider($proxyType);
            $locations = $provider === 'decodo'
                ? $this->decodo->getLocations($proxyType)
                : $this->brightData->getLocations($proxyType);
        } catch (\Throwable) {
            // Return a fallback static list if providers unreachable
            $locations = $this->staticLocationFallback();
        }

        return ApiResponse::ok($locations);
    }

    public function priceEstimate(Request $request)
    {
        $request->validate([
            'proxy_type'   => ['required', 'string'],
            'bandwidth_gb' => ['nullable', 'numeric', 'min:0.1'],
            'ip_count'     => ['nullable', 'integer', 'min:1'],
            'duration_days'=> ['nullable', 'integer', 'min:1'],
        ]);

        $service = Service::where('category', 'proxy')->where('is_active', true)->first();

        $amountMinor = $this->provisioning->calculatePrice(
            $service,
            $request->input('proxy_type'),
            $request->input('bandwidth_gb'),
            (int) $request->input('ip_count', 1),
            (int) $request->input('duration_days', 30),
        );

        return ApiResponse::ok([
            'amount'       => '$' . number_format($amountMinor / 100, 2),
            'amount_minor' => $amountMinor,
            'currency'     => 'USD',
        ]);
    }

    // ─── My proxies ───────────────────────────────────────────────────────────

    public function index(Request $request)
    {
        $subs = ProxySubscription::where('user_id', $request->user()->id)
            ->whereNotIn('status', ['cancelled'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($s) => $this->formatSubscription($s));

        return ApiResponse::ok($subs);
    }

    public function show(Request $request, string $id)
    {
        $sub = ProxySubscription::where('public_id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        return ApiResponse::ok($this->formatSubscription($sub, true));
    }

    // ─── Actions ──────────────────────────────────────────────────────────────

    public function rotate(Request $request, string $id)
    {
        $sub = ProxySubscription::where('public_id', $id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();

        $sub = $this->provisioning->rotateCredentials($sub);

        return ApiResponse::ok($this->formatSubscription($sub, true), 'Session rotated.');
    }

    public function renew(Request $request, string $id)
    {
        $request->validate(['duration_days' => ['nullable', 'integer', 'min:1', 'max:365']]);

        $sub  = ProxySubscription::where('public_id', $id)
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['active', 'expired'])
            ->firstOrFail();

        $days = (int) $request->input('duration_days', 30);
        $sub  = $this->provisioning->renew($sub, $request->user(), $days);

        return ApiResponse::ok($this->formatSubscription($sub, true), 'Subscription renewed.');
    }

    public function cancel(Request $request, string $id)
    {
        $sub = ProxySubscription::where('public_id', $id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();

        $this->provisioning->cancel($sub);

        return ApiResponse::ok(null, 'Subscription cancelled.');
    }

    public function usage(Request $request, string $id)
    {
        $sub = ProxySubscription::where('public_id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $this->provisioning->syncUsage($sub);
        $sub->refresh();

        $logs = $sub->usageLogs()
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn($l) => [
                'event'        => $l->event_type,
                'bandwidth_mb' => $l->bandwidth_mb,
                'data'         => $l->data,
                'at'           => $l->created_at?->toISOString(),
            ]);

        return ApiResponse::ok([
            'bandwidth_gb_used'    => $sub->bandwidth_gb_used,
            'bandwidth_gb_total'   => $sub->bandwidth_gb_total,
            'bandwidth_percent'    => $sub->bandwidthPercent(),
            'bandwidth_remaining'  => $sub->bandwidthRemaining(),
            'last_synced_at'       => $sub->last_synced_at?->toISOString(),
            'logs'                 => $logs,
        ]);
    }

    public function testProxy(Request $request, string $id)
    {
        $sub = ProxySubscription::where('public_id', $id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();

        $creds  = $sub->toCredentials();
        $result = $sub->provider === 'decodo'
            ? $this->decodo->testProxy($creds)
            : $this->brightData->testProxy($creds);

        return ApiResponse::ok($result);
    }

    // ─── Trial ────────────────────────────────────────────────────────────────

    public function claimTrial(Request $request)
    {
        $user = $request->user();

        $sub = $this->provisioning->claimTrial($user);

        return ApiResponse::ok($this->formatSubscription($sub, true), 'Free trial proxy activated.');
    }

    public function trialStatus(Request $request)
    {
        $trial   = ProxyTrial::where('user_id', $request->user()->id)->first();
        $claimed = $trial !== null;

        return ApiResponse::ok([
            'claimed'    => $claimed,
            'expires_at' => $trial?->expires_at?->toISOString(),
        ]);
    }

    // ─── Connection examples ───────────────────────────────────────────────────

    public function connectionExamples(Request $request, string $id)
    {
        $sub  = ProxySubscription::where('public_id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
        $c    = $sub->toCredentials();
        $pass = $c['password'] ?? '';

        $examples = [
            'curl' => "curl --proxy {$c['protocol']}://{$c['username']}:{$pass}@{$c['host']}:{$c['port']} https://ip.decodo.com",
            'python' => implode("\n", [
                "import requests",
                "",
                "proxies = {",
                "    'http':  '{$c['protocol']}://{$c['username']}:{$pass}@{$c['host']}:{$c['port']}',",
                "    'https': '{$c['protocol']}://{$c['username']}:{$pass}@{$c['host']}:{$c['port']}',",
                "}",
                "",
                "response = requests.get('https://ip.decodo.com', proxies=proxies)",
                "print(response.json())",
            ]),
            'nodejs' => implode("\n", [
                "const { HttpsProxyAgent } = require('https-proxy-agent');",
                "const fetch = require('node-fetch');",
                "",
                "const proxyUrl = '{$c['protocol']}://{$c['username']}:{$pass}@{$c['host']}:{$c['port']}';",
                "const agent = new HttpsProxyAgent(proxyUrl);",
                "",
                "fetch('https://ip.decodo.com', { agent })",
                "  .then(r => r.json())",
                "  .then(console.log);",
            ]),
            'php' => implode("\n", [
                "\$ch = curl_init('https://ip.decodo.com');",
                "curl_setopt(\$ch, CURLOPT_PROXY, '{$c['host']}:{$c['port']}');",
                "curl_setopt(\$ch, CURLOPT_PROXYUSERPWD, '{$c['username']}:{$pass}');",
                "curl_setopt(\$ch, CURLOPT_PROXYTYPE, CURLPROXY_HTTP);",
                "curl_setopt(\$ch, CURLOPT_RETURNTRANSFER, true);",
                "\$result = curl_exec(\$ch);",
                "echo \$result;",
            ]),
        ];

        if ($c['protocol'] === 'socks5') {
            $examples['curl'] = "curl --socks5 {$c['host']}:{$c['port']} -U {$c['username']}:{$pass} https://ip.decodo.com";
        }

        return ApiResponse::ok($examples);
    }

    // ─── API Keys (reseller) ──────────────────────────────────────────────────

    public function listApiKeys(Request $request)
    {
        $keys = ProxyApiKey::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($k) => [
                'id'           => $k->public_id,
                'name'         => $k->name,
                'prefix'       => $k->key_prefix,
                'scopes'       => $k->scopes,
                'ip_whitelist' => $k->ip_whitelist,
                'is_active'    => $k->is_active,
                'request_count'=> $k->request_count,
                'last_used_at' => $k->last_used_at?->toISOString(),
                'created_at'   => $k->created_at->toISOString(),
            ]);

        return ApiResponse::ok($keys);
    }

    public function createApiKey(Request $request)
    {
        $request->validate([
            'name'         => ['required', 'string', 'max:80'],
            'scopes'       => ['nullable', 'array'],
            'scopes.*'     => ['string', 'in:buy,renew,check,credentials'],
            'ip_whitelist' => ['nullable', 'array'],
            'ip_whitelist.*' => ['ip'],
        ]);

        if (ProxyApiKey::where('user_id', $request->user()->id)->where('is_active', true)->count() >= 10) {
            return ApiResponse::fail('Maximum of 10 active API keys allowed.', null, 422);
        }

        $rawKey = ProxyApiKey::generateRawKey();

        $key = ProxyApiKey::create([
            'public_id'    => (string) Str::uuid(),
            'user_id'      => $request->user()->id,
            'name'         => $request->input('name'),
            'key_hash'     => ProxyApiKey::hashKey($rawKey),
            'key_prefix'   => substr($rawKey, 0, 10),
            'scopes'       => $request->input('scopes'),
            'ip_whitelist' => $request->input('ip_whitelist'),
        ]);

        return ApiResponse::ok([
            'id'     => $key->public_id,
            'name'   => $key->name,
            'key'    => $rawKey,  // Only returned once
            'prefix' => $key->key_prefix,
        ], 'API key created. Save the key — it won\'t be shown again.');
    }

    public function rotateApiKey(Request $request, string $id)
    {
        $key    = ProxyApiKey::where('public_id', $id)->where('user_id', $request->user()->id)->firstOrFail();
        $rawKey = ProxyApiKey::generateRawKey();

        $key->update([
            'key_hash'   => ProxyApiKey::hashKey($rawKey),
            'key_prefix' => substr($rawKey, 0, 10),
        ]);

        return ApiResponse::ok(['key' => $rawKey, 'prefix' => $key->key_prefix], 'API key rotated.');
    }

    public function revokeApiKey(Request $request, string $id)
    {
        $key = ProxyApiKey::where('public_id', $id)->where('user_id', $request->user()->id)->firstOrFail();
        $key->update(['is_active' => false]);

        return ApiResponse::ok(null, 'API key revoked.');
    }

    // ─── Format helper ────────────────────────────────────────────────────────

    private function formatSubscription(ProxySubscription $sub, bool $withCredentials = false): array
    {
        $data = [
            'id'                   => $sub->public_id,
            'provider'             => $sub->provider,
            'proxy_type'           => $sub->proxy_type,
            'proxy_type_label'     => ProxySubscription::typeLabel($sub->proxy_type),
            'protocol'             => $sub->protocol,
            'host'                 => $sub->host,
            'port'                 => $sub->port,
            'username'             => $sub->username,
            'location_country'     => $sub->location_country,
            'location_city'        => $sub->location_city,
            'bandwidth_gb_total'   => (float) $sub->bandwidth_gb_total,
            'bandwidth_gb_used'    => (float) $sub->bandwidth_gb_used,
            'bandwidth_percent'    => $sub->bandwidthPercent(),
            'bandwidth_remaining'  => $sub->bandwidthRemaining(),
            'ip_count'             => $sub->ip_count,
            'threads'              => $sub->threads,
            'status'               => $sub->status,
            'is_trial'             => $sub->is_trial,
            'auto_renew'           => $sub->auto_renew,
            'expires_at'           => $sub->expires_at?->toISOString(),
            'provisioned_at'       => $sub->provisioned_at?->toISOString(),
            'last_synced_at'       => $sub->last_synced_at?->toISOString(),
        ];

        if ($withCredentials) {
            $data['password']  = $sub->getPassword();
            $data['proxy_url'] = $sub->getProxyUrl();
        }

        return $data;
    }

    private function staticLocationFallback(): array
    {
        return [
            ['country_code' => 'US', 'country_name' => 'United States', 'city' => null, 'available' => true],
            ['country_code' => 'GB', 'country_name' => 'United Kingdom', 'city' => null, 'available' => true],
            ['country_code' => 'DE', 'country_name' => 'Germany', 'city' => null, 'available' => true],
            ['country_code' => 'FR', 'country_name' => 'France', 'city' => null, 'available' => true],
            ['country_code' => 'CA', 'country_name' => 'Canada', 'city' => null, 'available' => true],
            ['country_code' => 'AU', 'country_name' => 'Australia', 'city' => null, 'available' => true],
            ['country_code' => 'NG', 'country_name' => 'Nigeria', 'city' => null, 'available' => true],
            ['country_code' => 'IN', 'country_name' => 'India', 'city' => null, 'available' => true],
            ['country_code' => 'BR', 'country_name' => 'Brazil', 'city' => null, 'available' => true],
            ['country_code' => 'SG', 'country_name' => 'Singapore', 'city' => null, 'available' => true],
            ['country_code' => 'JP', 'country_name' => 'Japan', 'city' => null, 'available' => true],
            ['country_code' => 'NL', 'country_name' => 'Netherlands', 'city' => null, 'available' => true],
        ];
    }
}
