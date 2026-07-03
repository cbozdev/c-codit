<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\ProxySubscription;
use App\Models\ProxyUsageLog;
use App\Services\Proxy\ProxyProvisioningService;
use App\Services\Proxy\ProxyRoutingEngine;
use App\Support\ApiResponse;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ProxyAdminController extends Controller
{
    public function __construct(
        private readonly ProxyProvisioningService $provisioning,
        private readonly ProxyRoutingEngine       $routing,
    ) {}

    // ─── Overview ─────────────────────────────────────────────────────────────

    public function overview()
    {
        $total    = ProxySubscription::count();
        $active   = ProxySubscription::where('status', 'active')->count();
        $expired  = ProxySubscription::where('status', 'expired')->count();
        $trial    = ProxySubscription::where('is_trial', true)->count();
        $revenue  = DB::table('service_orders')
            ->join('services', 'services.id', '=', 'service_orders.service_id')
            ->where('services.category', 'proxy')
            ->where('service_orders.status', 'completed')
            ->sum('service_orders.amount_minor');

        $byProvider = ProxySubscription::selectRaw('provider, count(*) as count')
            ->where('status', 'active')
            ->groupBy('provider')
            ->pluck('count', 'provider');

        $byType = ProxySubscription::selectRaw('proxy_type, count(*) as count')
            ->where('status', 'active')
            ->groupBy('proxy_type')
            ->pluck('count', 'proxy_type');

        return ApiResponse::ok([
            'total_subscriptions'  => $total,
            'active_subscriptions' => $active,
            'expired_subscriptions'=> $expired,
            'trial_subscriptions'  => $trial,
            'revenue_usd'          => number_format($revenue / 100, 2),
            'by_provider'          => $byProvider,
            'by_type'              => $byType,
            'provider_stats'       => $this->routing->getProviderStats(),
        ]);
    }

    // ─── All subscriptions ────────────────────────────────────────────────────

    public function subscriptions(Request $request)
    {
        $request->validate([
            'status'   => ['nullable', 'string'],
            'provider' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $q = ProxySubscription::with('user:id,name,email,public_id')
            ->orderByDesc('created_at');

        if ($status = $request->input('status'))   $q->where('status', $status);
        if ($provider = $request->input('provider')) $q->where('provider', $provider);

        $page = $q->paginate((int) ($request->input('per_page', 25)));

        $items = collect($page->items())->map(fn($sub) => [
            'id'                 => $sub->public_id,
            'provider'           => $sub->provider,
            'proxy_type'         => $sub->proxy_type,
            'status'             => $sub->status,
            'location_country'   => $sub->location_country,
            'is_trial'           => (bool) $sub->is_trial,
            'bandwidth_gb_used'  => (float) $sub->bandwidth_gb_used,
            'bandwidth_gb_total' => (float) $sub->bandwidth_gb_total,
            'expires_at'         => $sub->expires_at?->toISOString(),
            'created_at'         => $sub->created_at->toISOString(),
            'user'               => $sub->user ? [
                'name'      => $sub->user->name,
                'email'     => $sub->user->email,
                'public_id' => $sub->user->public_id,
            ] : null,
        ]);

        return ApiResponse::ok([
            'items' => $items,
            'meta'  => [
                'total'        => $page->total(),
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
            ],
        ]);
    }

    // ─── Provider management ──────────────────────────────────────────────────

    public function providerSettings()
    {
        $dbDecodo      = AppSetting::getValue('proxy.decodo.enabled');
        $dbProxyEmpire = AppSetting::getValue('proxy.proxyempire.enabled');

        return ApiResponse::ok([
            'decodo' => [
                'enabled' => $dbDecodo !== null
                    ? filter_var($dbDecodo, FILTER_VALIDATE_BOOLEAN)
                    : (bool) config('services.decodo.enabled', true),
            ],
            'proxyempire' => [
                'enabled' => $dbProxyEmpire !== null
                    ? filter_var($dbProxyEmpire, FILTER_VALIDATE_BOOLEAN)
                    : (bool) config('services.proxyempire.enabled', false),
            ],
            'routing_priority' => config('services.proxy.provider_priority', ['decodo', 'proxyempire']),
            'stats'            => $this->routing->getProviderStats(),
        ]);
    }

    public function updateProviderSettings(Request $request)
    {
        $request->validate([
            'provider_priority'   => ['nullable', 'array'],
            'provider_priority.*' => ['in:decodo,proxyempire,brightdata'],
            'decodo_enabled'      => ['nullable', 'boolean'],
            'proxyempire_enabled' => ['nullable', 'boolean'],
            'brightdata_enabled'  => ['nullable', 'boolean'],
        ]);

        if ($request->has('provider_priority')) {
            AppSetting::setValue('proxy_provider_priority', json_encode($request->input('provider_priority')));
            Cache::forget('config');
        }

        if ($request->has('decodo_enabled')) {
            AppSetting::setValue('proxy.decodo.enabled', $request->boolean('decodo_enabled') ? '1' : '0');
            Cache::forget('proxy.decodo.enabled');
        }

        if ($request->has('proxyempire_enabled')) {
            AppSetting::setValue('proxy.proxyempire.enabled', $request->boolean('proxyempire_enabled') ? '1' : '0');
            Cache::forget('proxy.proxyempire.enabled');
        }

        Audit::log('admin.proxy_provider_settings_updated', $request->user(), $request->only([
            'decodo_enabled', 'proxyempire_enabled', 'provider_priority',
        ]), actorType: 'admin');

        return ApiResponse::ok(null, 'Provider settings updated.');
    }

    // ─── Subscription actions ─────────────────────────────────────────────────

    public function forceReprovision(Request $request, string $id)
    {
        $sub = ProxySubscription::where('public_id', $id)->firstOrFail();

        try {
            $sub = $this->provisioning->rotateCredentials($sub);
            Audit::log('admin.proxy.reprovision', $request->user(), ['subscription_id' => $id], actorType: 'admin');
            return ApiResponse::ok(['status' => $sub->status], 'Credentials refreshed.');
        } catch (\Throwable $e) {
            return ApiResponse::fail('Reprovision failed: ' . $e->getMessage(), null, 500);
        }
    }

    public function resetCredentials(Request $request, string $id)
    {
        return $this->forceReprovision($request, $id);
    }

    public function syncUsage(Request $request, string $id)
    {
        $sub = ProxySubscription::where('public_id', $id)->firstOrFail();
        $this->provisioning->syncUsage($sub);
        $sub->refresh();

        return ApiResponse::ok([
            'bandwidth_gb_used'  => $sub->bandwidth_gb_used,
            'bandwidth_gb_total' => $sub->bandwidth_gb_total,
            'last_synced_at'     => $sub->last_synced_at?->toISOString(),
        ]);
    }

    public function cancelSubscription(Request $request, string $id)
    {
        $sub = ProxySubscription::where('public_id', $id)->firstOrFail();
        $this->provisioning->cancel($sub);

        Audit::log('admin.proxy.cancel', $request->user(), ['subscription_id' => $id], actorType: 'admin');
        return ApiResponse::ok(null, 'Subscription cancelled by admin.');
    }

    // ─── Analytics ────────────────────────────────────────────────────────────

    public function analytics(Request $request)
    {
        $days = (int) $request->input('days', 30);

        $revenue = DB::table('service_orders')
            ->join('services', 'services.id', '=', 'service_orders.service_id')
            ->where('services.category', 'proxy')
            ->where('service_orders.status', 'completed')
            ->where('service_orders.created_at', '>=', now()->subDays($days))
            ->selectRaw('DATE(service_orders.created_at) as date, SUM(service_orders.amount_minor) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $bandwidth = ProxyUsageLog::where('event_type', 'bandwidth_sync')
            ->where('created_at', '>=', now()->subDays($days))
            ->selectRaw('DATE(created_at) as date, SUM(bandwidth_mb) as total_mb')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $newSubs = ProxySubscription::where('created_at', '>=', now()->subDays($days))
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return ApiResponse::ok([
            'revenue'    => $revenue,
            'bandwidth'  => $bandwidth,
            'new_subs'   => $newSubs,
        ]);
    }

    // ─── Decodo sub-user list (for finding ISP sub-user ID) ──────────────────

    public function decodoSubUsers(\App\Services\Proxy\DecodoService $decodo)
    {
        $users = $decodo->listSubUsers();
        return ApiResponse::ok(['sub_users' => $users]);
    }

    // ─── Import marketplace listings from uploaded JSON/CSV ──────────────────

    public function syncListings(Request $request)
    {
        $request->validate([
            'file' => ['nullable', 'file', 'max:10240'],
            'data' => ['nullable', 'string'],
        ]);

        if ($request->hasFile('file')) {
            $content = file_get_contents($request->file('file')->getRealPath());
        } elseif ($request->filled('data')) {
            $content = $request->input('data');
        } else {
            return ApiResponse::fail('Please upload a JSON or CSV file, or provide raw JSON in the data field.', null, 422);
        }

        // Try JSON first, then CSV/text (IP:PORT per line or similar)
        $proxies = json_decode($content, true);

        if (! is_array($proxies)) {
            // Try CSV: ip,country,state,city,isp,type,protocol
            $rows = [];
            foreach (explode("\n", $content) as $line) {
                $line = trim($line);
                if (! $line || str_starts_with($line, '#')) continue;
                $cols = str_getcsv($line);
                if (count($cols) >= 4) {
                    $rows[] = [
                        'ip'           => $cols[0] ?? null,
                        'country_code' => $cols[1] ?? null,
                        'state_code'   => $cols[2] ?? null,
                        'city'         => $cols[3] ?? null,
                        'isp'          => $cols[4] ?? null,
                        'type'         => $cols[5] ?? 'wifi',
                        'protocol'     => $cols[6] ?? 'http',
                        'speed_ms'     => (int) ($cols[7] ?? 120),
                    ];
                }
            }
            $proxies = $rows;
        }

        if (empty($proxies)) {
            return ApiResponse::fail('No valid proxy data found in file.', null, 422);
        }

        $now   = now()->toDateTimeString();
        $rows  = [];
        $order = 0;

        foreach ($proxies as $proxy) {
            $ip          = $proxy['ip'] ?? $proxy['host'] ?? null;
            $countryCode = strtoupper($proxy['country_code'] ?? $proxy['country'] ?? '');
            if (! $countryCode) continue;

            $parts     = $ip ? explode('.', $ip) : [];
            $ipDisplay = count($parts) === 4 ? "{$parts[0]}.{$parts[1]}.xxx.xxx" : ($ip ?? 'xxx.xxx.xxx.xxx');
            $connType  = match (strtolower($proxy['type'] ?? $proxy['connection_type'] ?? '')) {
                'cellular', 'cell', 'mobile' => 'cell',
                default                       => 'wifi',
            };
            $proto = str_contains(strtolower($proxy['protocol'] ?? ''), 'socks') ? 'socks5' : 'http';
            $priceMinor = match ("{$connType}-{$proto}") {
                'wifi-http'   => 1650,  'wifi-socks5'  => 1950,
                'cell-http'   => 2250,  'cell-socks5'  => 2550,
                default       => 9700,
            };

            // Encrypt ISP proxy password if provided
            $proxyPasswordEncrypted = null;
            if (! empty($proxy['proxy_password'])) {
                $proxyPasswordEncrypted = \Illuminate\Support\Facades\Crypt::encryptString($proxy['proxy_password']);
            }

            $rows[] = [
                'public_id'                => (string) \Illuminate\Support\Str::uuid(),
                'country_code'             => $countryCode,
                'country_name'             => $proxy['country_name'] ?? $countryCode,
                'state_code'               => strtoupper($proxy['state_code'] ?? $proxy['state'] ?? '') ?: null,
                'state_name'               => $proxy['state_name'] ?? null,
                'city'                     => $proxy['city'] ?? null,
                'isp'                      => $proxy['isp'] ?? null,
                'zip'                      => $proxy['zip'] ?? null,
                'ip_display'               => $ipDisplay,
                'connection_type'          => $connType,
                'protocol'                 => $proto,
                'speed_ms'                 => max(1, (int) ($proxy['speed_ms'] ?? $proxy['ping'] ?? 120)),
                'price_minor'              => $priceMinor,
                'is_available'             => (bool) ($proxy['available'] ?? $proxy['is_available'] ?? true),
                'sort_order'               => $order++,
                'proxy_host'               => $proxy['proxy_host'] ?? null,
                'proxy_port'               => isset($proxy['proxy_port']) ? (int) $proxy['proxy_port'] : null,
                'proxy_username'           => $proxy['proxy_username'] ?? null,
                'proxy_password_encrypted' => $proxyPasswordEncrypted,
                'created_at'               => $now,
                'updated_at'               => $now,
            ];
        }

        if (empty($rows)) {
            return ApiResponse::fail('No valid rows could be parsed from the file.', null, 422);
        }

        DB::transaction(function () use ($rows) {
            DB::table('proxy_listings')->delete();
            foreach (array_chunk($rows, 200) as $chunk) {
                DB::table('proxy_listings')->insert($chunk);
            }
        });

        return ApiResponse::ok(['count' => count($rows)], count($rows) . ' proxy listings imported successfully.');
    }
}
