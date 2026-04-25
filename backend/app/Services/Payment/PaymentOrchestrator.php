<?php

namespace App\Services\Payment;

use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Models\WebhookEvent;
use App\Services\Ledger\ChartOfAccounts;
use App\Services\Payment\Contracts\PaymentGateway;
use App\Services\Wallet\WalletService;
use App\Support\Audit;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Coordinates payment lifecycle across providers. Webhook handlers push raw
 * events here; we verify authenticity, re-fetch state from the provider, and
 * only then credit the wallet.
 *
 * All operations are idempotent:
 *  - duplicate webhooks are detected via webhook_events.signature_hash
 *  - wallet crediting uses the payment's idempotency_key
 */
class PaymentOrchestrator
{
    public function __construct(
        private readonly FlutterwaveService $flutterwave,
        private readonly NowPaymentsService $nowpayments,
        private readonly WalletService $wallets,
    ) {}

    public function for(PaymentProvider|string $provider): PaymentGateway
    {
        $provider = $provider instanceof PaymentProvider ? $provider : PaymentProvider::from($provider);
        return match ($provider) {
            PaymentProvider::FLUTTERWAVE => $this->flutterwave,
            PaymentProvider::NOWPAYMENTS => $this->nowpayments,
            default => throw new RuntimeException("Unsupported payment provider: {$provider->value}"),
        };
    }

    /**
     * Handle an incoming webhook. Returns true if processed, false if duplicate/ignored.
     */
    public function handleWebhook(PaymentProvider $provider, string $rawBody, array $headers): bool
    {
        $gateway = $this->for($provider);

        // 1. Signature verification.
        if (! $gateway->verifyWebhook($rawBody, $headers)) {
            Log::channel('webhooks')->warning('webhook.invalid_signature', [
                'provider' => $provider->value,
            ]);
            throw new RuntimeException('Invalid webhook signature.');
        }

        $payload = json_decode($rawBody, true) ?: [];
        $sigHeader = $headers['verif-hash'][0]
            ?? $headers['x-nowpayments-sig'][0]
            ?? '';
        $sigHash = hash('sha256', $sigHeader.'|'.$rawBody);

        // 2. Deduplicate — the same signature hash must only be processed once.
        $event = WebhookEvent::firstOrCreate(
            ['provider' => $provider->value, 'signature_hash' => $sigHash],
            [
                'event_id'  => $payload['id'] ?? $payload['data']['id'] ?? null,
                'signature' => mb_substr((string) $sigHeader, 0, 512),
                'payload'   => $payload,
                'status'    => 'received',
            ],
        );

        if ($event->wasRecentlyCreated === false && $event->status === 'processed') {
            Log::channel('webhooks')->info('webhook.duplicate', [
                'provider' => $provider->value, 'id' => $event->id,
            ]);
            return false;
        }

        $parsed = $gateway->parseWebhook($payload);
        if (! $parsed) {
            $event->update(['status' => 'duplicate']);
            return false;
        }

        try {
            DB::transaction(function () use ($gateway, $parsed, $event) {
                $payment = Payment::where('provider_reference', $parsed['provider_reference'])
                    ->where('provider', $gateway->providerCode())
                    ->lockForUpdate()
                    ->first();

                if (! $payment) {
                    throw new RuntimeException("Unknown payment reference: {$parsed['provider_reference']}");
                }

                // Short-circuit if already final.
                if (in_array($payment->status, [PaymentStatus::SUCCESS, PaymentStatus::FAILED, PaymentStatus::EXPIRED], true)) {
                    $event->update([
                        'status'       => 'processed',
                        'processed_at' => now(),
                    ]);
                    return;
                }

                // 3. Authoritative re-verification against the provider API.
                $verified = $gateway->verifyPayment($payment->provider_reference);

                if ($verified['status'] === 'success') {
                    $payment->update([
                        'status'              => PaymentStatus::SUCCESS->value,
                        'provider_payment_id' => $verified['provider_payment_id'] ?? $payment->provider_payment_id,
                        'webhook_payload'     => $event->payload,
                        'verified_at'         => now(),
                    ]);

                    $cashAccountCode = $gateway->providerCode() === 'flutterwave'
                        ? ChartOfAccounts::CASH_FLUTTERWAVE
                        : ChartOfAccounts::CASH_NOWPAYMENTS;

                    $wallet = $this->wallets->getOrCreate($payment->user);

                    // Credit the wallet with the payment's stored amount (already in wallet currency)
                    $this->wallets->fundFromPayment(
                        wallet: $wallet,
                        amount: Money::minor($payment->amount_minor, $payment->currency),
                        cashAccountCode: $cashAccountCode,
                        idempotencyKey: 'payment_fund:'.$payment->public_id,
                        reference: $payment,
                        description: "Funding via {$gateway->providerCode()}",
                    );

                    Audit::log('payment.succeeded', $payment, [
                        'provider'     => $gateway->providerCode(),
                        'amount_minor' => $payment->amount_minor,
                    ], actorType: 'webhook');
                } elseif ($verified['status'] === 'failed') {
                    $payment->update([
                        'status'          => PaymentStatus::FAILED->value,
                        'webhook_payload' => $event->payload,
                    ]);
                    Audit::log('payment.failed', $payment, [
                        'provider' => $gateway->providerCode(),
                    ], actorType: 'webhook');
                } else {
                    $payment->update([
                        'status'          => PaymentStatus::PENDING->value,
                        'webhook_payload' => $event->payload,
                    ]);
                }

                $event->update(['status' => 'processed', 'processed_at' => now()]);
            });
        } catch (\Throwable $e) {
            $event->update([
                'status' => 'failed',
                'error'  => mb_substr($e->getMessage(), 0, 1000),
            ]);
            Log::channel('webhooks')->error('webhook.processing_failed', [
                'provider' => $provider->value,
                'error'    => $e->getMessage(),
            ]);
            throw $e;
        }

        return true;
    }
}
