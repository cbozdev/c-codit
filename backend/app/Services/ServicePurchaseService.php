<?php

namespace App\Services;

use App\Models\Service;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Esim\AiraloService;
use App\Services\Esim\BnesimService;
use App\Services\Esim\CelitechService;
use App\Services\Sms\FiveSimService;
use App\Services\Sms\ServiceUnavailableException;
use App\Services\Sms\SmsActivateService;
use App\Services\Sms\SmsManService;
use App\Services\Sms\SmsPoolService;
use App\Services\Sms\TextVerifiedService;
use App\Services\Proxy\ProxyProvisioningService;
use App\Services\Wallet\WalletService;
use App\Support\Audit;
use App\Support\Money;
use App\Support\UserNotify;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * End-to-end service purchase flow with automatic refund on provider failure.
 *
 * Supported providers: 5sim, smsactivate, flutterwave (bills), internal (gift cards)
 *
 * Steps:
 *   1. Pre-check availability & price.
 *   2. Hold funds in suspense (wallet debited atomically).
 *   3. Call provider (outside DB transaction).
 *   4. Success → settleSuspense + attach delivery.
 *      Failure → refundSuspense and mark order refunded.
 */
class ServicePurchaseService
{
    public function __construct(
        private readonly WalletService $wallets,
        private readonly FiveSimService $fiveSim,
        private readonly SmsActivateService $smsActivate,
        private readonly SmsManService $smsMan,
        private readonly SmsPoolService $smsPool,
        private readonly TextVerifiedService $textVerified,
        private readonly FlutterwaveBillsService $flutterwaveBills,
        private readonly GiftCardService $giftCards,
        private readonly AiraloService $airalo,
        private readonly CelitechService $celitech,
        private readonly BnesimService $bnesim,
        private readonly ProxyProvisioningService $proxy,
    ) {}

    public function purchase(
        User $user,
        Service $service,
        array $request,
        string $idempotencyKey,
    ): ServiceOrder {
        if (! $service->is_active) {
            throw new RuntimeException('This service is currently unavailable.');
        }
        if ($existing = ServiceOrder::where('idempotency_key', $idempotencyKey)->first()) {
            return $existing;
        }

        // Route to the correct handler based on provider
        return match ($service->provider) {
            '5sim'        => $this->purchaseVirtualNumber($user, $service, $request, $idempotencyKey, $this->fiveSim),
            'smsactivate' => $this->purchaseVirtualNumber($user, $service, $request, $idempotencyKey, $this->smsActivate),
            'smsman'      => $this->purchaseVirtualNumber($user, $service, $request, $idempotencyKey, $this->smsMan),
            'smspool'        => $this->purchaseVirtualNumber($user, $service, $request, $idempotencyKey, $this->smsPool),
            'textverified'        => $this->purchaseVirtualNumber($user, $service, $request, $idempotencyKey, $this->textVerified),
            'textverified_rental' => $this->purchaseTextVerifiedRental($user, $service, $request, $idempotencyKey),
            'flutterwave' => $this->purchaseUtilityBill($user, $service, $request, $idempotencyKey),
            'internal', 'reloadly'
                          => $this->purchaseGiftCard($user, $service, $request, $idempotencyKey),
            'airalo'      => $this->purchaseEsim($user, $service, $request, $idempotencyKey, $this->airalo),
            'celitech'    => $this->purchaseEsim($user, $service, $request, $idempotencyKey, $this->celitech),
            'bnesim'      => $this->purchaseEsim($user, $service, $request, $idempotencyKey, $this->bnesim),
            'smmpanel'    => $this->purchaseSmmOrder($user, $service, $request, $idempotencyKey),
            'proxy_auto', 'decodo', 'brightdata'
                          => $this->proxy->purchase($user, $service, $request, $idempotencyKey),
            default       => throw new RuntimeException("Unsupported service provider: {$service->provider}"),
        };
    }

    // ─── Virtual Numbers ──────────────────────────────────────────────────────

    private function purchaseVirtualNumber(
        User $user,
        Service $service,
        array $request,
        string $idempotencyKey,
        $provider,
    ): ServiceOrder {
        $price = $provider->getPrice((string) $request['service'], (string) $request['country']);
        if (! $price) {
            throw new ServiceUnavailableException('No numbers available for this service/country combination.');
        }

        $finalAmount = $this->applyMarkup($price, $service);
        $wallet      = $this->wallets->getOrCreate($user);

        [$order, $holdTx] = DB::transaction(function () use (
            $user, $service, $request, $idempotencyKey, $wallet, $finalAmount, $price
        ) {
            $order = ServiceOrder::create([
                'user_id'         => $user->id,
                'service_id'      => $service->id,
                'status'          => 'pending',
                'amount_minor'    => $finalAmount->amountMinor,
                'cost_minor'      => $price->amountMinor,
                'currency'        => $finalAmount->currency,
                'request'         => $request,
                'idempotency_key' => $idempotencyKey,
            ]);

            $holdTx = $this->wallets->holdForPurchase(
                wallet: $wallet,
                amount: $finalAmount,
                idempotencyKey: 'svcorder:'.$order->public_id,
                reference: $order,
                description: "Purchase: {$service->name}",
            );

            $order->update(['transaction_id' => $holdTx->id, 'status' => 'provisioning']);
            return [$order, $holdTx];
        });

        try {
            $result = $provider->purchase((string) $request['service'], (string) $request['country']);
        } catch (\Throwable $e) {
            $this->refundOrder($order, $holdTx, $e->getMessage());
            throw $e;
        }

        DB::transaction(function () use ($order, $holdTx, $result) {
            $this->wallets->settleSuspense($holdTx, 'svcsettle:'.$order->public_id);
            $order->update([
                'status'            => 'completed',
                'provider_order_id' => $result['provider_order_id'] ?? null,
                'provider_response' => $result['raw'] ?? null,
                'delivery'          => [
                    'phone_number' => $result['phone_number'] ?? null,
                    'expires_at'   => $result['expires_at'] ?? null,
                    'service_name' => ucfirst($request['service'] ?? ''),
                    'country'      => ucfirst($request['country'] ?? ''),
                ],
                'provisioned_at' => now(),
            ]);
        });

        UserNotify::send($user, 'order_completed', 'Order completed', 'Your virtual number is ready.', ['order_id' => $order->public_id]);
        $this->maybeRewardReferrer($user);

        Audit::log('service.purchased', $order, ['amount_minor' => $finalAmount->amountMinor]);
        return $order->fresh();
    }

    // ─── TextVerified Rental ─────────────────────────────────────────────────

    private function purchaseTextVerifiedRental(
        User $user,
        Service $service,
        array $request,
        string $idempotencyKey,
    ): ServiceOrder {
        $svcSlug = (string) $request['service'];
        $duration = (string) ($request['duration'] ?? 'oneDay');

        $price = $this->textVerified->getRentalPrice($svcSlug, $duration);
        if (! $price) {
            throw new ServiceUnavailableException('Rental numbers are not available for this service.');
        }

        $finalAmount = $this->applyMarkup($price, $service);
        $wallet = $this->wallets->getOrCreate($user, $finalAmount->currency);

        $order = ServiceOrder::create([
            'user_id'         => $user->id,
            'service_id'      => $service->id,
            'status'          => 'pending',
            'amount_minor'    => $finalAmount->amountMinor,
            'cost_minor'      => $price->amountMinor,
            'currency'        => $finalAmount->currency,
            'request'         => $request,
            'idempotency_key' => $idempotencyKey,
        ]);

        $holdTx = $this->wallets->holdForPurchase(
            wallet: $wallet,
            amount: $finalAmount,
            idempotencyKey: 'svcorder:'.$order->public_id,
            reference: $order,
            description: "Purchase: {$service->name}",
        );

        $order->update(['transaction_id' => $holdTx->id, 'status' => 'provisioning']);

        try {
            $result = $this->textVerified->purchaseRental($svcSlug, $duration);
        } catch (\Throwable $e) {
            $this->refundOrder($order, $holdTx, $e->getMessage());
            throw $e;
        }

        DB::transaction(function () use ($order, $holdTx, $result, $request, $duration) {
            $this->wallets->settleSuspense($holdTx, 'svcsettle:'.$order->public_id);
            $order->update([
                'status'            => 'completed',
                'provider_order_id' => $result['provider_order_id'] ?? null,
                'provider_response' => $result['raw'] ?? null,
                'delivery'          => [
                    'phone_number' => $result['phone_number'] ?? null,
                    'expires_at'   => $result['expires_at'] ?? null,
                    'service_name' => ucfirst($request['service'] ?? ''),
                    'duration'     => TextVerifiedService::RENTAL_DURATIONS[$duration] ?? $duration,
                    'type'         => 'rental',
                ],
                'provisioned_at' => now(),
            ]);
        });

        UserNotify::send($user, 'order_completed', 'Order completed', 'Your rental number is ready.', ['order_id' => $order->public_id]);
        $this->maybeRewardReferrer($user);

        Audit::log('service.purchased', $order, ['amount_minor' => $finalAmount->amountMinor]);
        return $order->fresh();
    }

    // ─── Utility Bills (Flutterwave) ──────────────────────────────────────────

    private function purchaseUtilityBill(
        User $user,
        Service $service,
        array $request,
        string $idempotencyKey,
    ): ServiceOrder {
        $amountNgn   = (float) ($request['amount'] ?? 100);
        $amountMinor = (int) round($amountNgn * 100);

        $wallet = $this->wallets->getOrCreate($user);

        // Convert NGN amount to USD for wallet deduction (using approximate rate)
        // In production, use a real FX rate API
        $ngnUsdRate = (float) config('services.platform.ngn_usd_rate', 0.00065);
        $usdMinor = (int) round($amountMinor * $ngnUsdRate);
        $finalAmount = Money::minor(max($usdMinor, 100), 'USD'); // minimum $1

        $order = ServiceOrder::create([
            'user_id'         => $user->id,
            'service_id'      => $service->id,
            'status'          => 'pending',
            'amount_minor'    => $finalAmount->amountMinor,
            'currency'        => 'USD',
            'request'         => $request,
            'idempotency_key' => $idempotencyKey,
        ]);

        $holdTx = $this->wallets->holdForPurchase(
            wallet: $wallet,
            amount: $finalAmount,
            idempotencyKey: 'svcorder:'.$order->public_id,
            reference: $order,
            description: "Bill: {$service->name}",
        );

        $order->update(['transaction_id' => $holdTx->id, 'status' => 'provisioning']);

        $txRef = 'bill-'.(string) Str::ulid();

        try {
            $result = match ($service->code) {
                'utility_airtime_ng' => $this->flutterwaveBills->buyAirtime(
                    phone: (string) $request['phone_number'],
                    network: (string) $request['network'],
                    amount: $amountNgn,
                    txRef: $txRef,
                ),
                'utility_data_ng' => $this->flutterwaveBills->buyData(
                    phone: (string) $request['phone_number'],
                    network: (string) $request['network'],
                    itemCode: (string) ($request['plan_code'] ?? ''),
                    billerCode: (string) ($request['biller_code'] ?? ''),
                    amount: $amountNgn,
                    txRef: $txRef,
                ),
                'utility_electricity' => $this->flutterwaveBills->payElectricity(
                    meterNumber: (string) $request['meter_number'],
                    disco: (string) $request['network'],
                    meterType: (string) ($request['meter_type'] ?? 'prepaid'),
                    amount: $amountNgn,
                    txRef: $txRef,
                ),
                'utility_dstv', 'utility_startimes' => $this->flutterwaveBills->payTV(
                    smartcardNumber: (string) $request['smartcard_number'],
                    provider: (string) $request['network'],
                    txRef: $txRef,
                ),
                default => throw new RuntimeException("Unknown utility service: {$service->code}"),
            };
        } catch (\Throwable $e) {
            $this->refundOrder($order, $holdTx, $e->getMessage());
            throw $e;
        }

        DB::transaction(function () use ($order, $holdTx, $result, $txRef) {
            $this->wallets->settleSuspense($holdTx, 'svcsettle:'.$order->public_id);
            $order->update([
                'status'            => 'completed',
                'provider_order_id' => $txRef,
                'provider_response' => $result,
                'delivery'          => [
                    'token'         => $result['token'] ?? null,
                    'units'         => $result['units'] ?? null,
                    'reference'     => $txRef,
                    'message'       => $result['message'] ?? 'Payment successful',
                ],
                'provisioned_at' => now(),
            ]);
        });

        Audit::log('service.utility_bill_paid', $order);
        return $order->fresh();
    }

    // ─── Gift Cards ───────────────────────────────────────────────────────────

    private function purchaseGiftCard(
        User $user,
        Service $service,
        array $request,
        string $idempotencyKey,
    ): ServiceOrder {
        $denomination    = (float) ($request['denomination'] ?? 10);
        $productId       = (int) ($request['reloadly_product_id'] ?? 0);
        $recipientEmail  = $request['recipient_email'] ?? null;

        // Price = denomination amount (Reloadly charges sender == recipient for USD cards)
        $priceMinor  = $this->giftCards->getPrice($service->code, $denomination);
        $finalAmount = Money::minor($priceMinor, 'USD');
        $wallet      = $this->wallets->getOrCreate($user, 'USD');

        $order = ServiceOrder::create([
            'user_id'         => $user->id,
            'service_id'      => $service->id,
            'status'          => 'pending',
            'amount_minor'    => $finalAmount->amountMinor,
            'currency'        => 'USD',
            'request'         => $request,
            'idempotency_key' => $idempotencyKey,
        ]);

        $holdTx = $this->wallets->holdForPurchase(
            wallet:         $wallet,
            amount:         $finalAmount,
            idempotencyKey: 'svcorder:'.$order->public_id,
            reference:      $order,
            description:    "Gift Card: {$service->name} \${$denomination}",
        );

        $order->update(['transaction_id' => $holdTx->id, 'status' => 'provisioning']);

        try {
            if ($service->provider === 'reloadly' && $productId > 0) {
                $result = $this->giftCards->purchase($user, $productId, $denomination, $order->public_id, $recipientEmail);
            } else {
                // Legacy manual fulfillment (internal provider)
                $result = [
                    'type'       => 'giftcard',
                    'provider'   => 'manual',
                    'product'    => $service->code,
                    'denomination' => $denomination,
                    'note'       => 'Gift card will be delivered to your registered email within 24 hours.',
                ];
            }
        } catch (\Throwable $e) {
            $this->refundOrder($order, $holdTx, $e->getMessage());
            throw $e;
        }

        DB::transaction(function () use ($order, $holdTx, $result) {
            $this->wallets->settleSuspense($holdTx, 'svcsettle:'.$order->public_id);
            $order->update([
                'status'            => 'completed',
                'provider_order_id' => $result['transaction_id'] ?? null,
                'delivery'          => $result,
                'provisioned_at'    => now(),
            ]);
        });

        Audit::log('service.gift_card_purchased', $order);
        return $order->fresh();
    }

    // ─── Travel eSIM ─────────────────────────────────────────────────────────

    private function purchaseEsim(
        User $user,
        Service $service,
        array $request,
        string $idempotencyKey,
        $esimProvider,
    ): ServiceOrder {
        $packageId = trim((string) ($request['package_id'] ?? ''));
        if (! $packageId) {
            throw new RuntimeException('Please select an eSIM plan before purchasing.');
        }

        $basePrice   = $esimProvider->getPackagePrice($packageId);
        $price       = \App\Support\Money::fromDecimal(number_format($basePrice, 2, '.', ''), 'USD');
        $finalAmount = $this->applyMarkup($price, $service);

        $wallet = $this->wallets->getOrCreate($user, 'USD');

        $order = ServiceOrder::create([
            'user_id'         => $user->id,
            'service_id'      => $service->id,
            'status'          => 'pending',
            'amount_minor'    => $finalAmount->amountMinor,
            'cost_minor'      => $price->amountMinor,
            'currency'        => 'USD',
            'request'         => $request,
            'idempotency_key' => $idempotencyKey,
        ]);

        $holdTx = $this->wallets->holdForPurchase(
            wallet: $wallet,
            amount: $finalAmount,
            idempotencyKey: 'svcorder:'.$order->public_id,
            reference: $order,
            description: "eSIM: {$service->name}",
        );

        $order->update(['transaction_id' => $holdTx->id, 'status' => 'provisioning']);

        try {
            $result = $esimProvider->purchase(
                packageId: $packageId,
                description: 'C-codit eSIM – user:'.$user->public_id,
            );
        } catch (\Throwable $e) {
            $this->refundOrder($order, $holdTx, $e->getMessage());
            throw $e;
        }

        DB::transaction(function () use ($order, $holdTx, $result, $request) {
            $this->wallets->settleSuspense($holdTx, 'svcsettle:'.$order->public_id);
            $order->update([
                'status'            => 'completed',
                'provider_order_id' => $result['provider_order_id'] ?? null,
                'provider_response' => $result,
                'delivery'          => [
                    'type'              => 'esim',
                    'package_id'        => $request['package_id'] ?? null,
                    'iccid'             => $result['iccid'] ?? null,
                    'activation_code'   => $result['activation_code'] ?? null,
                    'qrcode_url'        => $result['qrcode_url'] ?? null,
                    'direct_apple_url'  => $result['direct_apple_url'] ?? null,
                    'instructions_url'  => $result['instructions_url'] ?? null,
                ],
                'provisioned_at' => now(),
            ]);
        });

        Audit::log('service.esim_purchased', $order, ['amount_minor' => $finalAmount->amountMinor]);
        return $order->fresh();
    }

    // ─── SMM Panel (boost + accounts) ────────────────────────────────────────

    private function purchaseSmmOrder(
        User $user,
        Service $service,
        array $request,
        string $idempotencyKey,
    ): ServiceOrder {
        $smmServiceId = (int) ($request['smm_service_id'] ?? 0);
        $link         = trim((string) ($request['link'] ?? ''));
        $quantity     = (int) ($request['quantity'] ?? 0);

        if (! $smmServiceId || $quantity < 1) {
            throw new RuntimeException('Invalid SMM order: service_id and quantity are required.');
        }

        $panel        = \App\Services\Smm\SmmPanelService::forCategory($service->category);
        $panelService = $panel->getServiceById($smmServiceId);
        if (! $panelService) {
            throw new \App\Services\Sms\ServiceUnavailableException('SMM service not found in panel catalog.');
        }

        $min = (int) ($panelService['min'] ?? 10);
        $max = (int) ($panelService['max'] ?? 10_000_000);
        if ($quantity < $min || $quantity > $max) {
            throw new RuntimeException("Quantity must be between {$min} and {$max} for this service.");
        }

        $rateUsd     = (float) ($panelService['rate'] ?? 0);
        $baseUsd     = ($quantity / 1000) * $rateUsd;
        $price       = Money::fromDecimal(number_format(max($baseUsd, 0.01), 4, '.', ''), 'USD');
        $finalAmount = $this->applyMarkup($price, $service);

        $wallet = $this->wallets->getOrCreate($user, 'USD');

        $order = ServiceOrder::create([
            'user_id'         => $user->id,
            'service_id'      => $service->id,
            'status'          => 'pending',
            'amount_minor'    => $finalAmount->amountMinor,
            'cost_minor'      => $price->amountMinor,
            'currency'        => 'USD',
            'request'         => $request,
            'idempotency_key' => $idempotencyKey,
        ]);

        $holdTx = $this->wallets->holdForPurchase(
            wallet: $wallet,
            amount: $finalAmount,
            idempotencyKey: 'svcorder:' . $order->public_id,
            reference: $order,
            description: 'SMM: ' . mb_substr($panelService['name'], 0, 80),
        );

        $order->update(['transaction_id' => $holdTx->id, 'status' => 'provisioning']);

        try {
            $result = $panel->placeOrder($smmServiceId, $link, $quantity);
        } catch (\Throwable $e) {
            $this->refundOrder($order, $holdTx, $e->getMessage());
            throw $e;
        }

        DB::transaction(function () use ($order, $holdTx, $result, $panelService, $link, $quantity) {
            $this->wallets->settleSuspense($holdTx, 'svcsettle:' . $order->public_id);
            $order->update([
                'status'            => 'completed',
                'provider_order_id' => (string) ($result['order'] ?? ''),
                'provider_response' => $result,
                'delivery'          => [
                    'type'         => 'smm',
                    'panel_order'  => $result['order'] ?? null,
                    'service_name' => $panelService['name'],
                    'link'         => $link,
                    'quantity'     => $quantity,
                    'smm_status'   => 'Pending',
                ],
                'provisioned_at' => now(),
            ]);
        });

        Audit::log('service.smm_ordered', $order, ['amount_minor' => $finalAmount->amountMinor]);
        return $order->fresh();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function refundOrder($order, $holdTx, string $reason): void
    {
        Log::channel('payments')->error('service.provider_failed', [
            'service' => $order->service_id,
            'order'   => $order->public_id,
            'error'   => $reason,
        ]);
        DB::transaction(function () use ($order, $holdTx, $reason) {
            $this->wallets->refundSuspense(
                $holdTx,
                'svcrefund:'.$order->public_id,
                'Provider failed: '.mb_substr($reason, 0, 170),
            );
            $order->update([
                'status'         => 'refunded',
                'failure_reason' => mb_substr($reason, 0, 255),
                'refunded_at'    => now(),
            ]);
        });
        Audit::log('service.refunded', $order, ['reason' => $reason]);
    }

    private function applyMarkup(Money $providerCost, Service $service): Money
    {
        $markup = $service->markup_percent !== null
            ? (float) $service->markup_percent
            : (float) config('services.platform.markup_percent', 15);
        return $providerCost->add($providerCost->mulPercent($markup));
    }

    /**
     * Convert a Money amount to the target currency using the platform exchange rate.
     * Only USD↔NGN conversion is supported (other pairs pass through unchanged).
     */
    private function convertCurrency(Money $amount, string $targetCurrency): Money
    {
        if ($amount->currency === $targetCurrency) {
            return $amount;
        }

        $ngnPerUsd = 1.0 / max((float) config('services.platform.ngn_usd_rate', 0.00065), 0.000001);

        if ($amount->currency === 'USD' && $targetCurrency === 'NGN') {
            $ngnMinor = (int) round($amount->amountMinor * $ngnPerUsd);
            return Money::minor($ngnMinor, 'NGN');
        }

        if ($amount->currency === 'NGN' && $targetCurrency === 'USD') {
            $usdMinor = (int) round($amount->amountMinor / $ngnPerUsd);
            return Money::minor(max($usdMinor, 1), 'USD');
        }

        return $amount;
    }

    private function maybeRewardReferrer(User $user): void
    {
        if (! $user->referred_by) return;

        // Only reward on the user's first ever completed order
        $completedOrders = \App\Models\ServiceOrder::where('user_id', $user->id)
            ->where('status', 'completed')
            ->count();

        if ($completedOrders !== 1) return;

        $referrer = \App\Models\User::find($user->referred_by);
        if (! $referrer || ! $referrer->wallet) return;

        try {
            $reward = Money::fromDecimal('1.00', 'USD');
            $this->wallets->fundFromPayment(
                wallet: $referrer->wallet,
                amount: $reward,
                cashAccountCode: \App\Services\Ledger\ChartOfAccounts::REFUND_POOL,
                idempotencyKey: 'referral:' . $user->id,
                description: "Referral bonus — {$user->name} completed their first order",
            );
            UserNotify::send($referrer, 'referral_bonus', 'Referral bonus earned!', "\${reward->format()} added to your wallet because {$user->name} completed their first order.", ['amount' => '1.00']);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('referral.reward_failed', ['user' => $user->id, 'referrer' => $referrer->id, 'error' => $e->getMessage()]);
        }
    }
}
