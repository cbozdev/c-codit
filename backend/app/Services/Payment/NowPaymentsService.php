<?php

namespace App\Services\Payment;

use App\Enums\PaymentProvider;
use App\Models\Payment;
use App\Models\User;
use App\Services\Payment\Contracts\PaymentGateway;
use App\Support\Audit;
use App\Support\Money;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class NowPaymentsService implements PaymentGateway
{
    private string $baseUrl = 'https://api.nowpayments.io/v1';

    // Cached from parseWebhook so verifyPayment can use it within the same request.
    private ?string $lastWebhookPaymentId = null;

    private function client()
    {
        return Http::withHeaders([
            'x-api-key' => config('services.nowpayments.api_key'),
        ])->acceptJson();
    }

    public function providerCode(): string { return 'nowpayments'; }

    public function initiate(User $user, Money $amount, string $idempotencyKey, array $options = []): Payment
    {
        $payCurrency = $options['pay_currency'] ?? null; // optional pre-selection hint

        // Enforce $10 platform minimum for all crypto
        if ($amount->amountMinor < 1000) {
            throw new RuntimeException('Minimum deposit amount is $10.00 USD for cryptocurrency payments.');
        }

        // Enforce NowPayments' own per-crypto minimum when a currency is pre-selected
        if ($payCurrency) {
            $npMinUsd = $this->getMinimumUsd($payCurrency);
            if ($npMinUsd > 0 && ($amount->amountMinor / 100) < $npMinUsd) {
                throw new RuntimeException(
                    sprintf('Minimum deposit for %s is $%.2f USD. Please enter a higher amount.',
                        strtoupper($payCurrency), $npMinUsd)
                );
            }
        }

        $txRef = 'np-' . (string) Str::ulid();

        $payload = [
            'price_amount'      => (float) $amount->toDecimal(),
            'price_currency'    => 'usd',
            'order_id'          => $txRef,
            'order_description' => 'C-codit wallet funding - user:' . ($user->public_id ?? $user->id),
            'ipn_callback_url'  => config('app.url') . '/api/v1/webhooks/nowpayments',
            'success_url'       => config('services.nowpayments.success_url', config('app.url') . '/wallet/confirm'),
            'cancel_url'        => config('services.nowpayments.cancel_url',  config('app.url') . '/wallet'),
        ];

        // Pass preferred currency as pre-selection hint — user can still change it on the invoice page
        if ($payCurrency) {
            $payload['pay_currency'] = $payCurrency;
        }

        $res  = $this->client()->post($this->baseUrl . '/invoice', $payload);
        $body = $res->json();

        Log::channel('payments')->info('nowpayments.initiate', [
            'status'      => $res->status(),
            'order_id'    => $txRef,
            'invoice_id'  => $body['id'] ?? null,
            'invoice_url' => $body['invoice_url'] ?? null,
        ]);

        if ($res->failed() || empty($body['id'])) {
            throw new RuntimeException('NowPayments: ' . ($body['message'] ?? 'Could not create invoice.'));
        }

        return Payment::create([
            'user_id'                => $user->id,
            'provider'               => PaymentProvider::NOWPAYMENTS,
            'provider_reference'     => $txRef,
            'provider_payment_id'    => null, // Assigned by NowPayments once user pays (via IPN)
            'amount_minor'           => $amount->amountMinor,
            'currency'               => 'USD',
            'status'                 => 'initiated',
            'checkout_url'           => $body['invoice_url'],
            'idempotency_key'        => $idempotencyKey,
            'requested_amount_minor' => $amount->amountMinor,
            'requested_currency'     => 'USD',
            'metadata'               => [
                'user_public_id' => $user->public_id ?? $user->id,
                'invoice_id'     => (string) $body['id'],
                'pay_currency'   => $payCurrency,
                'purpose'        => 'wallet_fund',
            ],
        ]);
    }

    public function verifyPayment(string $providerReference): array
    {
        $payment = Payment::where('provider_reference', $providerReference)
            ->where('provider', PaymentProvider::NOWPAYMENTS)
            ->first();

        if (!$payment) {
            return ['status' => 'pending'];
        }

        // Invoice-based flow: provider_payment_id is null until the user pays.
        // parseWebhook caches the IPN's payment_id on this instance so we can use it here.
        $paymentId = $payment->provider_payment_id ?: $this->lastWebhookPaymentId;

        if (!$paymentId) {
            return ['status' => 'pending'];
        }

        $res  = $this->client()->get($this->baseUrl . '/payment/' . $paymentId);
        $body = $res->json();

        if ($res->failed()) {
            throw new RuntimeException('NowPayments verify failed: ' . ($body['message'] ?? 'Error'));
        }

        $paymentStatus = $body['payment_status'] ?? 'waiting';

        return [
            'status'              => $this->mapStatus($paymentStatus),
            'provider_payment_id' => (string) ($body['payment_id'] ?? $paymentId),
            'amount_minor'        => isset($body['price_amount'])
                ? (int) round(((float) $body['price_amount']) * 100)
                : $payment->amount_minor,
            'currency'            => strtoupper($body['price_currency'] ?? 'USD'),
        ];
    }

    public function verifyWebhook(string $rawBody, array $headers): bool
    {
        $secret    = (string) config('services.nowpayments.ipn_secret');
        $signature = $headers['x-nowpayments-sig'][0] ?? '';

        // If no secret configured, accept but log warning
        if (!$secret) {
            Log::channel('webhooks')->warning('nowpayments.no_secret_configured');
            return true;
        }

        if (!$signature) {
            Log::channel('webhooks')->warning('nowpayments.no_signature_header');
            return false;
        }

        $payload = json_decode($rawBody, true);
        if (!is_array($payload)) return false;

        ksort($payload);
        $expected = hash_hmac('sha512', json_encode($payload), $secret);

        $result = hash_equals($expected, $signature);
        Log::channel('webhooks')->info('nowpayments.signature_check', [
            'match'  => $result,
            'has_sig' => !empty($signature),
        ]);

        return $result;
    }

    public function parseWebhook(array $payload): ?array
    {
        $orderId = $payload['order_id'] ?? null;
        if (!$orderId) return null;

        // Cache so verifyPayment can use it within the same request (invoice-based flow).
        $this->lastWebhookPaymentId = !empty($payload['payment_id'])
            ? (string) $payload['payment_id']
            : null;

        return [
            'status'              => $this->mapStatus($payload['payment_status'] ?? 'waiting'),
            'provider_reference'  => $orderId,
            'provider_payment_id' => $this->lastWebhookPaymentId ?? '',
            'amount_minor'        => isset($payload['price_amount'])
                ? (int) round(((float) $payload['price_amount']) * 100)
                : 0,
            'currency'            => strtoupper($payload['price_currency'] ?? 'USD'),
        ];
    }

    private function getMinimumUsd(string $payCurrency): float
    {
        try {
            $res = $this->client()->get($this->baseUrl . '/min-amount', [
                'currency_from' => 'usd',
                'currency_to'   => $payCurrency,
            ]);
            if ($res->successful()) {
                return (float) ($res->json('min_amount') ?? 0);
            }
        } catch (\Throwable) {}
        return 0.0;
    }

    private function mapStatus(string $s): string
    {
        return match ($s) {
            'finished', 'confirmed' => 'success',
            'failed', 'expired', 'refunded' => 'failed',
            default => 'pending',
        };
    }
}
