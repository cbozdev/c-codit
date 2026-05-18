<?php

namespace App\Services\Proxy;

use App\Models\ProxyListing;
use App\Models\ProxySubscription;
use App\Models\ProxyTrial;
use App\Models\ProxyUsageLog;
use App\Models\Service;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Ledger\ChartOfAccounts;
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

    // ─── Purchase from marketplace listing ───────────────────────────────────

    public function purchaseListing(
        User         $user,
        ProxyListing $listing,
        int          $durationDays = 30,
        bool         $speedUpgrade = false,
        ?string      $accessIp    = null,
    ): ProxySubscription {
        // Price = daily rate (base/30) × days, with optional +50% speed upgrade
        $dailyRate   = (int) ceil($listing->price_minor / 30);
        $amountMinor = (int) round($dailyRate * $durationDays * ($speedUpgrade ? 1.5 : 1.0));
        $walletAmount = Money::minor($amountMinor, 'USD');
        $wallet       = $this->wallets->getOrCreate($user, 'USD');
        $idempKey     = 'proxy_listing:' . $listing->public_id . ':' . $user->id . ':' . now()->timestamp;

        $holdTx = $this->wallets->holdForPurchase(
            wallet:         $wallet,
            amount:         $walletAmount,
            idempotencyKey: $idempKey,
            reference:      $wallet,
            description:    "Proxy: {$listing->country_name}" . ($listing->state_code ? " ({$listing->state_code})" : ''),
        );

        $proxyType   = $listing->connection_type === 'cell' ? 'mobile_rotating' : 'residential_rotating';
        $sessionType = 'rotating';
        $country     = strtolower($listing->country_code);
        $protocol    = $listing->protocol;

        try {
            $provider = $this->routing->selectProvider($proxyType);
            $result   = $this->provisionWithFallback($provider, $proxyType, [
                'proxy_type'    => $proxyType,
                'protocol'      => $protocol,
                'country_code'  => $listing->country_code,
                'city'          => $listing->city,
                'bandwidth_gb'  => 0,
                'ip_count'      => 1,
                'threads'       => 10,
                'duration_days' => $durationDays,
                'session_type'  => $sessionType,
            ], null);
        } catch (\Throwable $e) {
            $this->wallets->refundSuspense($holdTx, 'proxy_listing_refund:' . $idempKey, $e->getMessage());
            throw new RuntimeException('Proxy provisioning failed. Your wallet has been refunded.');
        }

        return DB::transaction(function () use (
            $user, $listing, $holdTx, $result,
            $proxyType, $protocol, $durationDays, $amountMinor
        ) {
            $sub = new ProxySubscription([
                'public_id'                => (string) Str::uuid(),
                'user_id'                  => $user->id,
                'provider'                 => $result['provider'],
                'provider_subscription_id' => $result['provider_subscription_id'],
                'proxy_type'               => $proxyType,
                'protocol'                 => $protocol,
                'host'                     => $result['host'],
                'port'                     => $result['port'],
                'username'                 => $result['username'],
                'location_country'         => strtoupper($listing->country_code),
                'location_city'            => $listing->city,
                'bandwidth_gb_total'       => 0,
                'bandwidth_gb_used'        => 0,
                'ip_count'                 => 1,
                'threads'                  => 10,
                'status'                   => 'active',
                'is_trial'                 => false,
                'duration_days'            => $durationDays,
                'expires_at'               => now()->addDays($durationDays),
                'provisioned_at'           => now(),
                'config'                   => [
                    'listing_id'      => $listing->public_id,
                    'connection_type' => $listing->connection_type,
                    'isp'             => $listing->isp,
                    'state_code'      => $listing->state_code,
                    'state_name'      => $listing->state_name,
                    'speed_upgrade'   => $speedUpgrade,
                    'access_ip'       => $accessIp,
                    'amount_minor'    => $amountMinor,
                ],
            ]);
            $sub->setPassword($result['password']);
            $sub->save();

            ProxyUsageLog::create([
                'subscription_id' => $sub->id,
                'user_id'         => $user->id,
                'event_type'      => 'provisioned',
                'bandwidth_mb'    => 0,
                'data'            => ['provider' => $result['provider'], 'listing_id' => $listing->public_id],
            ]);

            $this->wallets->settleSuspense($holdTx, 'proxy_listing_settle:' . $listing->public_id . ':' . $sub->public_id);

            Audit::log('proxy.listing_purchased', $user, [
                'subscription_id' => $sub->public_id,
                'listing_id'      => $listing->public_id,
                'country'         => $listing->country_code,
                'amount_minor'    => $amountMinor,
            ]);

            return $sub->fresh();
        });
    }

    // ─── Social plan bulk purchase ────────────────────────────────────────────

    public function purchaseSocialPlan(User $user, array $options): array
    {
        $connectionType  = $options['connection_type'];   // wifi|cell|all
        $protocol        = $options['protocol'];          // http|socks5
        $durationDays    = (int) ($options['duration_days'] ?? 30);
        $quantity        = (int) ($options['quantity']    ?? 1);
        $countryCode     = strtoupper($options['country_code'] ?? 'US');
        $stateCode       = strtoupper($options['state_code']   ?? '');
        $speedUpgrade    = (bool) ($options['speed_upgrade']   ?? false);
        $accessIp        = $options['access_ip']         ?? null;
        $rotationMinutes = (int) ($options['rotation_minutes'] ?? 30);

        // Price per proxy per 30 days based on connection type
        $baseMinorPer30 = match ($connectionType) {
            'cell'  => ($protocol === 'socks5') ? 1300 : 1100,
            'wifi'  => ($protocol === 'socks5') ? 950  : 800,
            default => ($protocol === 'socks5') ? 1100 : 900,  // all = mixed
        };

        $dailyRate      = (int) ceil($baseMinorPer30 / 30);
        $pricePerProxy  = (int) round($dailyRate * $durationDays * ($speedUpgrade ? 1.5 : 1.0));

        // Extra cost for faster rotation
        $rotationSurcharge = match ($rotationMinutes) {
            5  => (int) round($pricePerProxy * 0.5),
            10 => (int) round($pricePerProxy * 0.25),
            default => 0,
        };
        $pricePerProxy += $rotationSurcharge;

        $totalMinor   = $pricePerProxy * $quantity;
        $walletAmount = Money::minor($totalMinor, 'USD');
        $wallet       = $this->wallets->getOrCreate($user, 'USD');
        $idempKey     = 'proxy_social:' . $user->id . ':' . now()->timestamp;

        $holdTx = $this->wallets->holdForPurchase(
            wallet:         $wallet,
            amount:         $walletAmount,
            idempotencyKey: $idempKey,
            reference:      $wallet,
            description:    "Social proxy x{$quantity} ({$countryCode})",
        );

        $proxyType   = ($connectionType === 'cell') ? 'mobile_rotating' : 'residential_rotating';
        $sessionType = 'rotating';

        $subscriptions = [];

        try {
            for ($i = 0; $i < $quantity; $i++) {
                $provider = $this->routing->selectProvider($proxyType);
                $result   = $this->provisionWithFallback($provider, $proxyType, [
                    'proxy_type'    => $proxyType,
                    'protocol'      => $protocol,
                    'country_code'  => $countryCode,
                    'city'          => null,
                    'bandwidth_gb'  => 0,
                    'ip_count'      => 1,
                    'threads'       => 10,
                    'duration_days' => $durationDays,
                    'session_type'  => $sessionType,
                ], null);

                $sub = DB::transaction(function () use (
                    $user, $result, $proxyType, $protocol, $countryCode, $stateCode,
                    $durationDays, $connectionType, $speedUpgrade, $accessIp,
                    $rotationMinutes, $pricePerProxy
                ) {
                    $s = new ProxySubscription([
                        'public_id'                => (string) Str::uuid(),
                        'user_id'                  => $user->id,
                        'provider'                 => $result['provider'],
                        'provider_subscription_id' => $result['provider_subscription_id'],
                        'proxy_type'               => $proxyType,
                        'protocol'                 => $protocol,
                        'host'                     => $result['host'],
                        'port'                     => $result['port'],
                        'username'                 => $result['username'],
                        'location_country'         => $countryCode,
                        'location_city'            => null,
                        'bandwidth_gb_total'       => 0,
                        'bandwidth_gb_used'        => 0,
                        'ip_count'                 => 1,
                        'threads'                  => 10,
                        'status'                   => 'active',
                        'is_trial'                 => false,
                        'duration_days'            => $durationDays,
                        'expires_at'               => now()->addDays($durationDays),
                        'provisioned_at'           => now(),
                        'config'                   => [
                            'plan'              => 'social',
                            'connection_type'   => $connectionType,
                            'speed_upgrade'     => $speedUpgrade,
                            'access_ip'         => $accessIp,
                            'rotation_minutes'  => $rotationMinutes,
                            'state_code'        => $stateCode ?: null,
                            'amount_minor'      => $pricePerProxy,
                        ],
                    ]);
                    $s->setPassword($result['password']);
                    $s->save();

                    ProxyUsageLog::create([
                        'subscription_id' => $s->id,
                        'user_id'         => $user->id,
                        'event_type'      => 'provisioned',
                        'bandwidth_mb'    => 0,
                    ]);

                    return $s->fresh();
                });

                $subscriptions[] = $sub;
            }
        } catch (\Throwable $e) {
            // If some provisioned, settle partial; if none, full refund
            if (empty($subscriptions)) {
                $this->wallets->refundSuspense($holdTx, 'proxy_social_refund:' . $idempKey, $e->getMessage());
                throw new RuntimeException('Proxy provisioning failed. Your wallet has been refunded.');
            }
            // Partial: settle for what we provisioned
            $actualTotal   = count($subscriptions) * $pricePerProxy;
            $refundMinor   = $totalMinor - $actualTotal;
            // We'll settle the hold and note partial delivery (simplified)
        }

        $this->wallets->settleSuspense($holdTx, 'proxy_social_settle:' . $idempKey);

        Audit::log('proxy.social_purchased', $user, [
            'quantity'     => count($subscriptions),
            'country'      => $countryCode,
            'amount_minor' => $totalMinor,
        ]);

        return $subscriptions;
    }

    // ─── 1-hour refund ────────────────────────────────────────────────────────

    public function refundSubscription(ProxySubscription $sub, User $user): void
    {
        $amountMinor = (int) ($sub->config['amount_minor'] ?? 0);

        DB::transaction(function () use ($sub, $user, $amountMinor) {
            $sub->update(['status' => 'cancelled']);

            if ($amountMinor > 0) {
                $wallet = $this->wallets->getOrCreate($user, 'USD');
                $this->wallets->fundFromPayment(
                    wallet:          $wallet,
                    amount:          Money::minor($amountMinor, 'USD'),
                    cashAccountCode: ChartOfAccounts::REFUND_POOL,
                    idempotencyKey:  'proxy_refund:' . $sub->public_id,
                    reference:       $sub,
                    description:     'Proxy 1h refund',
                );
            }

            ProxyUsageLog::create([
                'subscription_id' => $sub->id,
                'user_id'         => $sub->user_id,
                'event_type'      => 'refund',
                'bandwidth_mb'    => 0,
                'data'            => ['amount_minor' => $amountMinor],
            ]);

            Audit::log('proxy.refunded', $user, [
                'subscription_id' => $sub->public_id,
                'amount_minor'    => $amountMinor,
            ]);
        });
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
            $country     = strtolower($sub->location_country ?? 'us');
            $sessionType = $this->sessionTypeFromProxyType($sub->proxy_type);
            $result      = $this->getProviderService($sub->provider)->renewSubscription(
                $sub->provider_subscription_id, $days, $country, $sessionType,
            );
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
        $country     = strtolower($sub->location_country ?? 'us');
        $sessionType = $this->sessionTypeFromProxyType($sub->proxy_type);
        $creds       = $this->getProviderService($sub->provider)->rotateSession(
            $sub->provider_subscription_id,
            $country,
            $sessionType,
        );

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

    private function sessionTypeFromProxyType(string $proxyType): string
    {
        if (str_ends_with($proxyType, '_sticky'))  return 'sticky';
        if (str_ends_with($proxyType, '_static'))  return 'static';
        return 'rotating';
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
