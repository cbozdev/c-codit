<?php

namespace App\Services\Proxy;

use App\Models\ProxySubscription;
use App\Models\ProxyTrial;
use App\Models\ProxyUsageLog;
use App\Models\Service;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Wallet\WalletService;
use App\Support\Audit;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class ProxyProvisioningService
{
    public function __construct(
        private readonly WalletService      $wallets,
        private readonly ProxyRoutingEngine $routing,
        private readonly DecodoService      $decodo,
        private readonly BrightDataService  $brightData,
    ) {}

    // ─── Main purchase flow ───────────────────────────────────────────────────

    public function purchase(
        User    $user,
        Service $service,
        array   $request,
        string  $idempotencyKey,
    ): ServiceOrder {
        if ($existing = ServiceOrder::where('idempotency_key', $idempotencyKey)->first()) {
            return $existing;
        }

        $this->validateRequest($request);

        $proxyType    = $request['proxy_type'];
        $protocol     = $request['protocol']      ?? 'http';
        $countryCode  = strtoupper($request['country_code'] ?? 'US');
        $city         = $request['city']           ?? null;
        $bandwidthGb  = isset($request['bandwidth_gb']) ? (float) $request['bandwidth_gb'] : null;
        $ipCount      = (int) ($request['ip_count']      ?? 1);
        $threads      = (int) ($request['threads']       ?? 10);
        $durationDays = (int) ($request['duration_days'] ?? 30);
        $sessionType  = $request['session_type']   ?? 'rotating';
        $autoRenew    = (bool) ($request['auto_renew']   ?? false);

        $amountMinor  = $this->calculatePrice($service, $proxyType, $bandwidthGb, $ipCount, $durationDays);
        $walletAmount = Money::minor($amountMinor, 'USD');
        $wallet       = $this->wallets->getOrCreate($user, 'USD');

        // Create order before hold so we have a reference
        $order = ServiceOrder::create([
            'public_id'       => (string) Str::uuid(),
            'user_id'         => $user->id,
            'service_id'      => $service->id,
            'status'          => 'pending',
            'amount_minor'    => $amountMinor,
            'currency'        => 'USD',
            'idempotency_key' => $idempotencyKey,
            'request'         => $request,
        ]);

        // Hold funds
        $holdTx = $this->wallets->holdForPurchase(
            wallet: $wallet,
            amount: $walletAmount,
            idempotencyKey: 'proxy:'.$order->public_id,
            reference: $order,
            description: "Proxy: {$service->name}",
        );

        $order->update(['transaction_id' => $holdTx->id, 'status' => 'provisioning']);

        try {
            $provider = $this->routing->selectProvider($proxyType, $request['provider'] ?? null);

            $result = $this->provisionWithFallback($provider, $proxyType, [
                'proxy_type'   => $proxyType,
                'protocol'     => $protocol,
                'country_code' => $countryCode,
                'city'         => $city,
                'bandwidth_gb' => $bandwidthGb,
                'ip_count'     => $ipCount,
                'threads'      => $threads,
                'duration_days'=> $durationDays,
                'session_type' => $sessionType,
            ], $request['provider'] ?? null);

        } catch (\Throwable $e) {
            $this->wallets->refundSuspense($holdTx, 'proxy_refund:'.$order->public_id, $e->getMessage());
            $order->update(['status' => 'failed', 'failure_reason' => $e->getMessage()]);
            Log::error('proxy.purchase.failed', ['user' => $user->id, 'error' => $e->getMessage()]);
            throw new RuntimeException('Proxy provisioning failed. Your wallet has been refunded.');
        }

        // Provision succeeded — create subscription
        DB::transaction(function () use (
            $user, $service, $order, $holdTx, $result,
            $proxyType, $protocol, $countryCode, $city,
            $bandwidthGb, $ipCount, $threads, $durationDays, $autoRenew, $amountMinor
        ) {
            $sub = new ProxySubscription([
                'public_id'                => (string) Str::uuid(),
                'user_id'                  => $user->id,
                'service_order_id'         => $order->id,
                'provider'                 => $result['provider'],
                'provider_subscription_id' => $result['provider_subscription_id'],
                'proxy_type'               => $proxyType,
                'protocol'                 => $protocol,
                'host'                     => $result['host'],
                'port'                     => $result['port'],
                'username'                 => $result['username'],
                'location_country'         => $countryCode,
                'location_city'            => $city,
                'bandwidth_gb_total'       => $bandwidthGb ?? 0,
                'bandwidth_gb_used'        => 0,
                'ip_count'                 => $ipCount,
                'threads'                  => $threads,
                'status'                   => 'active',
                'auto_renew'               => $autoRenew,
                'is_trial'                 => false,
                'duration_days'            => $durationDays,
                'expires_at'               => $result['expires_at'],
                'provisioned_at'           => now(),
            ]);
            $sub->setPassword($result['password']);
            $sub->save();

            ProxyUsageLog::create([
                'subscription_id' => $sub->id,
                'user_id'         => $user->id,
                'event_type'      => 'provisioned',
                'bandwidth_mb'    => 0,
                'data'            => ['provider' => $result['provider']],
            ]);

            $this->wallets->settleSuspense($holdTx, 'proxy_settle:'.$order->public_id);

            $order->update([
                'status'            => 'completed',
                'provider_order_id' => $result['provider_subscription_id'],
                'provisioned_at'    => now(),
                'provider_response' => ['provider' => $result['provider']],
                'delivery'          => [
                    'subscription_id' => $sub->public_id,
                    'host'            => $result['host'],
                    'port'            => $result['port'],
                    'username'        => $result['username'],
                    'password'        => $result['password'],
                    'protocol'        => $protocol,
                    'proxy_url'       => "{$protocol}://{$result['username']}:{$result['password']}@{$result['host']}:{$result['port']}",
                    'expires_at'      => $result['expires_at'],
                ],
            ]);

            Audit::log('proxy.purchased', $user, [
                'subscription_id' => $sub->public_id,
                'provider'        => $result['provider'],
                'proxy_type'      => $proxyType,
                'amount_minor'    => $amountMinor,
            ]);
        });

        return $order->fresh('service');
    }

    // ─── Trial ────────────────────────────────────────────────────────────────

    public function claimTrial(User $user): ProxySubscription
    {
        if (ProxyTrial::where('user_id', $user->id)->exists()) {
            throw new RuntimeException('You have already claimed your free trial.');
        }

        if (! $user->hasVerifiedEmail()) {
            throw new RuntimeException('Please verify your email before claiming a trial proxy.');
        }

        $provider = $this->routing->selectProvider('residential_rotating');
        $options  = [
            'proxy_type' => 'residential_rotating', 'protocol' => 'http',
            'country_code' => 'US', 'bandwidth_gb' => 0.1,
            'ip_count' => 1, 'threads' => 1, 'duration_days' => 1, 'session_type' => 'rotating',
        ];

        try {
            $result             = $this->callProvider($provider, $options);
            $result['provider'] = $provider;
        } catch (\Throwable) {
            try {
                $fallback           = $this->routing->fallback($provider, 'residential_rotating');
                $result             = $this->callProvider($fallback, $options);
                $result['provider'] = $fallback;
            } catch (\Throwable) {
                throw new RuntimeException('Trial proxy unavailable. Please try again later.');
            }
        }

        $sub = new ProxySubscription([
            'public_id'                => (string) Str::uuid(),
            'user_id'                  => $user->id,
            'provider'                 => $result['provider'],
            'provider_subscription_id' => $result['provider_subscription_id'],
            'proxy_type'               => 'residential_rotating',
            'protocol'                 => 'http',
            'host'                     => $result['host'],
            'port'                     => $result['port'],
            'username'                 => $result['username'],
            'location_country'         => 'US',
            'bandwidth_gb_total'       => 0.1,
            'bandwidth_gb_used'        => 0,
            'ip_count'                 => 1,
            'threads'                  => 1,
            'status'                   => 'active',
            'is_trial'                 => true,
            'duration_days'            => 1,
            'expires_at'               => now()->addDay(),
            'provisioned_at'           => now(),
        ]);
        $sub->setPassword($result['password']);
        $sub->save();

        ProxyTrial::create([
            'user_id'         => $user->id,
            'subscription_id' => $sub->id,
            'expires_at'      => now()->addDay(),
        ]);

        return $sub;
    }

    // ─── Sync usage ───────────────────────────────────────────────────────────

    public function syncUsage(ProxySubscription $sub): void
    {
        try {
            $usage       = $this->getProviderService($sub->provider)->getUsage($sub->provider_subscription_id);
            $previousUsed= $sub->bandwidth_gb_used;
            $newUsed     = $usage['bandwidth_gb_used'] ?? $sub->bandwidth_gb_used;
            $delta       = max(0, $newUsed - $previousUsed);

            $sub->update([
                'bandwidth_gb_used' => $newUsed,
                'last_synced_at'    => now(),
                'status'            => $sub->isExpired() ? 'expired' : $sub->status,
            ]);

            if ($delta > 0) {
                ProxyUsageLog::create([
                    'subscription_id' => $sub->id,
                    'user_id'         => $sub->user_id,
                    'event_type'      => 'bandwidth_sync',
                    'bandwidth_mb'    => $delta * 1024,
                    'data'            => ['raw' => $usage],
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('proxy.sync_usage.failed', ['subscription' => $sub->public_id, 'error' => $e->getMessage()]);
        }
    }

    // ─── Renew ────────────────────────────────────────────────────────────────

    public function renew(ProxySubscription $sub, User $user, int $days = 30): ProxySubscription
    {
        $service      = Service::where('category', 'proxy')->first();
        $amountMinor  = $this->calculatePrice($service, $sub->proxy_type, $sub->bandwidth_gb_total, $sub->ip_count, $days);
        $walletAmount = Money::minor($amountMinor, 'USD');
        $wallet       = $this->wallets->getOrCreate($user, 'USD');

        $holdTx = $this->wallets->holdForPurchase(
            wallet: $wallet,
            amount: $walletAmount,
            idempotencyKey: 'proxy_renew:' . $sub->public_id . ':' . now()->timestamp,
            reference: $sub,
            description: "Proxy renewal",
        );

        try {
            $result = $this->getProviderService($sub->provider)->renewSubscription($sub->provider_subscription_id, $days);
            $this->wallets->settleSuspense($holdTx, 'proxy_renew_settle:'.$sub->public_id.':'.now()->timestamp);

            $sub->update([
                'status'           => 'active',
                'duration_days'    => $days,
                'expires_at'       => $result['expires_at'],
                'bandwidth_gb_used'=> 0,
            ]);

            ProxyUsageLog::create([
                'subscription_id' => $sub->id,
                'user_id'         => $user->id,
                'event_type'      => 'renewal',
                'bandwidth_mb'    => 0,
                'data'            => ['days' => $days, 'amount_minor' => $amountMinor],
            ]);

            Audit::log('proxy.renewed', $user, ['subscription_id' => $sub->public_id, 'days' => $days]);
        } catch (\Throwable $e) {
            $this->wallets->refundSuspense($holdTx, 'proxy_renew_refund:'.$sub->public_id.':'.now()->timestamp);
            throw new RuntimeException('Renewal failed. Your wallet has been refunded.');
        }

        return $sub->fresh();
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────

    public function cancel(ProxySubscription $sub): void
    {
        try {
            $this->getProviderService($sub->provider)->cancelSubscription($sub->provider_subscription_id);
        } catch (\Throwable $e) {
            Log::warning('proxy.cancel.provider_error', ['error' => $e->getMessage()]);
        }

        $sub->update(['status' => 'cancelled']);

        ProxyUsageLog::create([
            'subscription_id' => $sub->id,
            'user_id'         => $sub->user_id,
            'event_type'      => 'cancel',
            'bandwidth_mb'    => 0,
        ]);
    }

    // ─── Rotate credentials ───────────────────────────────────────────────────

    public function rotateCredentials(ProxySubscription $sub): ProxySubscription
    {
        $creds = $this->getProviderService($sub->provider)->rotateSession($sub->provider_subscription_id);

        if (! empty($creds['username'])) $sub->username = $creds['username'];
        if (! empty($creds['password'])) $sub->setPassword($creds['password']);
        $sub->save();

        ProxyUsageLog::create([
            'subscription_id' => $sub->id,
            'user_id'         => $sub->user_id,
            'event_type'      => 'credential_refresh',
            'bandwidth_mb'    => 0,
        ]);

        return $sub->fresh();
    }

    // ─── Price calculation ────────────────────────────────────────────────────

    public function calculatePrice(
        ?Service $service,
        string   $proxyType,
        ?float   $bandwidthGb,
        int      $ipCount,
        int      $durationDays,
    ): int {
        $markupPct = $service?->markup_percent ?? 25;

        $baseMinor = match (true) {
            str_starts_with($proxyType, 'residential') => (int) (($bandwidthGb ?? 1) * 350 * ($durationDays / 30)),
            str_starts_with($proxyType, 'datacenter') && str_ends_with($proxyType, 'dedicated') => $ipCount * 200,
            str_starts_with($proxyType, 'datacenter')  => $ipCount * 80,
            str_starts_with($proxyType, 'isp')         => $ipCount * 250,
            str_starts_with($proxyType, 'mobile')      => (int) (($bandwidthGb ?? 1) * 1200 * ($durationDays / 30)),
            default                                     => 1000,
        };

        return (int) round($baseMinor * (1 + $markupPct / 100));
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private function provisionWithFallback(string $provider, string $proxyType, array $options, ?string $forced): array
    {
        try {
            $result             = $this->callProvider($provider, $options);
            $result['provider'] = $provider;
            return $result;
        } catch (\Throwable $e) {
            Log::warning('proxy.provision.primary_failed', ['provider' => $provider, 'error' => $e->getMessage()]);
            if ($forced) throw $e;
            $fallback           = $this->routing->fallback($provider, $proxyType);
            $result             = $this->callProvider($fallback, $options);
            $result['provider'] = $fallback;
            return $result;
        }
    }

    private function callProvider(string $provider, array $options): array
    {
        return $this->getProviderService($provider)->createSubscription($options);
    }

    private function getProviderService(string $provider): DecodoService|BrightDataService
    {
        return match ($provider) {
            'decodo'     => $this->decodo,
            'brightdata' => $this->brightData,
            default      => throw new RuntimeException("Unknown proxy provider: {$provider}"),
        };
    }

    private function validateRequest(array $request): void
    {
        $validTypes = [
            'residential_rotating', 'residential_sticky', 'residential_static',
            'datacenter_shared', 'datacenter_dedicated',
            'isp_static', 'isp_rotating', 'mobile_rotating',
        ];

        if (! in_array($request['proxy_type'] ?? '', $validTypes, true)) {
            throw new RuntimeException('Invalid proxy type selected.');
        }

        if (! in_array($request['protocol'] ?? 'http', ['http', 'https', 'socks5'], true)) {
            throw new RuntimeException('Invalid protocol selected.');
        }
    }
}
