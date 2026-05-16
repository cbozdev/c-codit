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

        return ApiResponse::ok([
            'items' => $page->items(),
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
        return ApiResponse::ok([
            'decodo' => [
                'enabled'  => config('services.decodo.enabled', true),
                'priority' => 0,
            ],
            'brightdata' => [
                'enabled'  => config('services.brightdata.enabled', true),
                'priority' => 1,
            ],
            'routing_priority' => config('services.proxy.provider_priority', ['decodo', 'brightdata']),
            'stats'            => $this->routing->getProviderStats(),
        ]);
    }

    public function updateProviderSettings(Request $request)
    {
        $request->validate([
            'provider_priority' => ['nullable', 'array'],
            'provider_priority.*' => ['in:decodo,brightdata'],
            'decodo_enabled'    => ['nullable', 'boolean'],
            'brightdata_enabled'=> ['nullable', 'boolean'],
        ]);

        if ($request->has('provider_priority')) {
            AppSetting::setValue('proxy_provider_priority', json_encode($request->input('provider_priority')));
            Cache::forget('config');
        }

        Audit::log('admin.proxy_provider_settings_updated', $request->user(), $request->all(), actorType: 'admin');

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
}
