<?php

namespace App\Console\Commands;

use App\Models\ServiceOrder;
use App\Services\Wallet\WalletService;
use App\Support\Audit;
use App\Support\Money;
use App\Services\Ledger\ChartOfAccounts;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutoCancelExpiredOrders extends Command
{
    protected $signature   = 'orders:auto-cancel-expired';
    protected $description = 'Auto-cancel and refund SMS number orders whose time expired without receiving a code';

    private const SMS_PROVIDERS = [
        '5sim', 'smsactivate', 'smsman', 'smspool', 'pvadeals',
        'textverified', 'textverified_rental',
    ];

    public function handle(WalletService $wallets): int
    {
        // 1. Expired orders with no code received
        $orders = ServiceOrder::whereIn('status', ['pending', 'provisioning', 'completed'])
            ->where('expires_at', '<', now())
            ->whereNull('refunded_at')
            ->whereHas('service', fn ($q) => $q->whereIn('provider', self::SMS_PROVIDERS))
            ->with(['service', 'transaction'])
            ->get()
            ->filter(fn ($o) => empty($o->delivery['sms_code'] ?? null));

        foreach ($orders as $order) {
            try {
                $this->cancelOrder($order, $wallets);
                Log::info('orders.auto_cancelled', ['order' => $order->public_id]);
            } catch (\Throwable $e) {
                Log::warning('orders.auto_cancel_failed', [
                    'order' => $order->public_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return 0;
    }

    private function cancelOrder(ServiceOrder $order, WalletService $wallets, string $reason = 'Number expired — no code received'): void
    {
        // Cancel with provider (best-effort)
        try {
            if ($order->provider_order_id) {
                $provider = $order->service->provider ?? '';
                match ($provider) {
                    '5sim'                => app(\App\Services\Sms\FiveSimService::class)->cancel($order->provider_order_id),
                    'smsactivate'         => app(\App\Services\Sms\SmsActivateService::class)->cancel($order->provider_order_id),
                    'smsman'              => app(\App\Services\Sms\SmsManService::class)->cancel($order->provider_order_id),
                    'smspool'             => app(\App\Services\Sms\SmsPoolService::class)->cancel($order->provider_order_id),
                    'pvadeals'            => app(\App\Services\Sms\PvaDealsService::class)->cancel($order->provider_order_id),
                    'textverified'        => app(\App\Services\Sms\TextVerifiedService::class)->cancel($order->provider_order_id),
                    'textverified_rental' => app(\App\Services\Sms\TextVerifiedService::class)->cancelRental($order->provider_order_id),
                    default               => null,
                };
            }
        } catch (\Throwable $e) {
            Log::warning('orders.auto_cancel.provider_failed', [
                'order'    => $order->public_id,
                'provider' => $order->service->provider ?? '?',
                'error'    => $e->getMessage(),
            ]);
        }

        // Refund wallet
        $holdTx = $order->transaction;
        if (! $holdTx) {
            return;
        }

        DB::transaction(function () use ($wallets, $holdTx, $order, $reason) {
            $freshTx   = $holdTx->fresh();
            $statusStr = $freshTx->status instanceof \BackedEnum
                ? $freshTx->status->value
                : (string) $freshTx->status;

            if ($statusStr === 'processing') {
                $wallets->refundSuspense(
                    $freshTx,
                    'auto_cancel:' . $order->public_id,
                    $reason,
                );
            } else {
                $wallet = $freshTx->wallet;
                $amount = Money::minor($freshTx->amount_minor, $freshTx->currency);
                $wallets->fundFromPayment(
                    wallet:           $wallet,
                    amount:           $amount,
                    cashAccountCode:  ChartOfAccounts::SUSPENSE,
                    idempotencyKey:   'auto_cancel:' . $order->public_id,
                    description:      'Refund: ' . $reason,
                );
            }

            $order->update([
                'status'         => 'refunded',
                'failure_reason' => $reason,
                'refunded_at'    => now(),
            ]);
        });

        Audit::log('service.auto_cancelled', $order);
    }
}
