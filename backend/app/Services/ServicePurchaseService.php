<?php

namespace App\Services;

use App\Models\Service;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Sms\FiveSimService;
use App\Services\Sms\ServiceUnavailableException;
use App\Services\Sms\SmsActivateService;
use App\Services\Wallet\WalletService;
use App\Support\Audit;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * End-to-end service purchase flow with automatic refund on provider failure.
 *
 * Steps:
 *   1. Pre-check availability & price (no DB lock).
 *   2. Hold funds in suspense (wallet debited atomically).
 *   3. Call provider (outside DB transaction — external IO).
 *   4. Success → settleSuspense + attach delivery.
 *      Failure → refundSuspense and mark order refunded.
 */
class ServicePurchaseService
{
    public function __construct(
        private readonly WalletService $wallets,
        private readonly FiveSimService $fiveSim,
        private readonly SmsActivateService $smsActivate,
    ) {}

    public function purchase(
        User $user,
        Service $service,
        array $request,
        string $idempotencyKey,
    ): ServiceOrder {
        if (! $service->is_active) {
            throw new RuntimeException('This service is currently disabled.');
        }
        if ($existing = ServiceOrder::where('idempotency_key', $idempotencyKey)->first()) {
            return $existing;
        }

        $provider = $this->providerFor($service);

        $price = $provider->getPrice((string) $request['service'], (string) $request['country']);
        if (! $price) {
            throw new ServiceUnavailableException('Service not available for this country.');
        }

        $finalAmount = $this->applyMarkup($price, $service);

        $order = ServiceOrder::create([
            'user_id'         => $user->id,
            'service_id'      => $service->id,
            'status'          => 'pending',
            'amount_minor'    => $finalAmount->amountMinor,
            'currency'        => $finalAmount->currency,
            'request'         => $request,
            'idempotency_key' => $idempotencyKey,
        ]);

        $wallet = $this->wallets->getOrCreate($user, $finalAmount->currency);

        $holdTx = $this->wallets->holdForPurchase(
            wallet: $wallet,
            amount: $finalAmount,
            idempotencyKey: 'svcorder:'.$order->public_id,
            reference: $order,
            description: "Purchase: {$service->name}",
        );

        $order->update(['transaction_id' => $holdTx->id, 'status' => 'provisioning']);

        try {
            $result = $provider->purchase(
                (string) $request['service'],
                (string) $request['country'],
            );
        } catch (\Throwable $e) {
            Log::channel('payments')->error('service.provider_failed', [
                'service' => $service->code,
                'order'   => $order->public_id,
                'error'   => $e->getMessage(),
            ]);
            DB::transaction(function () use ($order, $holdTx, $e) {
                $this->wallets->refundSuspense(
                    $holdTx,
                    'svcrefund:'.$order->public_id,
                    'Provider failed: '.mb_substr($e->getMessage(), 0, 200),
                );
                $order->update([
                    'status'         => 'refunded',
                    'failure_reason' => mb_substr($e->getMessage(), 0, 255),
                    'refunded_at'    => now(),
                ]);
            });
            Audit::log('service.refunded', $order, ['reason' => $e->getMessage()]);
            throw $e;
        }

        DB::transaction(function () use ($order, $holdTx, $result) {
            $this->wallets->settleSuspense($holdTx, 'svcsettle:'.$order->public_id);
            $order->update([
                'status'            => 'completed',
                'provider_order_id' => $result['provider_order_id'] ?? null,
                'provider_response' => $result['raw'] ?? null,
                'delivery' => [
                    'phone_number' => $result['phone_number'] ?? null,
                    'expires_at'   => $result['expires_at'] ?? null,
                ],
                'provisioned_at' => now(),
            ]);
        });

        Audit::log('service.purchased', $order, ['amount_minor' => $finalAmount->amountMinor]);
        return $order->fresh();
    }

    private function providerFor(Service $service)
    {
        return match ($service->provider) {
            '5sim'        => $this->fiveSim,
            'smsactivate' => $this->smsActivate,
            default       => throw new RuntimeException("Unsupported service provider: {$service->provider}"),
        };
    }

    private function applyMarkup(Money $providerCost, Service $service): Money
    {
        $markup = $service->markup_percent !== null
            ? (float) $service->markup_percent
            : (float) config('services.platform.markup_percent', 15);
        return $providerCost->add($providerCost->mulPercent($markup));
    }
}
