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

    private function client()
    {
        return Http::withHeaders([
            'x-api-key' => config('services.nowpayments.api_key'),
        ])->acceptJson();
    }

    public function providerCode(): string { return 'nowpayments'; }

    public function initiate(User $user, Money $amount, string $idempotencyKey, array $options = []): Payment
    {
        // NowPayments minimum is $20 USD to cover all crypto minimums
        $minorMin = 2000; // $20.00 in cents
        if ($amount->amountMinor < $minorMin) {
            $amount = Money::minor($minorMin, 'USD');
        }

        $payCurrency = $options['pay_currency'] ?? 'usdttrc20';
        $txRef       = 'np-' . (string) Str::ulid();

        $payload = [
            'price_amount'     => (float) $amount->toDecimal(),
            'price_currency'   => 'usd',
            'pay_currency'     => $payCurrency,
            'order_id'         => $txRef,
            'order_description'=> 'C-codit wallet funding',
            'ipn_callback_url' => config('app.url') . '/api/v1/webhooks/nowpayments',
            'success_url'      => config('services.nowpayments.success_url', config('app.url') . '/wallet/confirm'),
            'cancel_url'       => config('services.nowpayments.cancel_url',  config('app.url') . '/wallet'),
            'is_fixed_rate'    => false,
            'is_fee_paid_by_user' => false,
        ];

        // Add customer metadata
        $payload['customer_id'] = $user->public_id ?? $user->id;

        $res  = $this->client()->post($this->baseUrl . '/payment', $payload);
        $body = $res->json();

        Log::channel('payments')->info('nowpayments.initiate', [
            'status'   => $res->status(),
            'order_id' => $txRef,
            'body'     => $body,
        ]);

        if ($res->failed() || empty($body['payment_id'])) {
            throw new RuntimeException('NowPayments: ' . ($body['message'] ?? 'Could not create payment.'));
        }

        return Payment::create([
            'user_id'                => $user->id,
            'provider'               => PaymentProvider::NOWPAYMENTS,
            'provider_reference'     => $txRef,
            'provider_payment_id'    => (string) $body['payment_id'],
            'amount_minor'           => $amount->amountMinor,
            'currency'               => 'USD',
            'status'                 => 'initiated',
            'checkout_url'           => $body['invoice_url'] ?? 'https://nowpayments.io/payment/?iid=' . $body['payment_id'],
            'idempotency_key'        => $idempotencyKey,
            'requested_amount_minor' => $amount->amountMinor,
            'requested_currency'     => 'USD',
            'metadata'               => [
                'user_public_id' => $user->public_id ?? $user->id,
                'pay_currency'   => $payCurrency,
                'purpose'        => 'wallet_fund',
            ],
        ]);
    }

    public function verifyPayment(string $providerReference): array
    {
        // Find payment by order_id
        $payment = Payment::where('provider_reference', $providerReference)
            ->where('provider', PaymentProvider::NOWPAYMENTS)
            ->first();

        if (!$payment || !$payment->provider_payment_id) {
            return ['status' => 'pending'];
        }

        $res  = $this->client()->get($this->baseUrl . '/payment/' . $payment->provider_payment_id);
        $body = $res->json();

        if ($res->failed()) {
            throw new RuntimeException('NowPayments verify failed: ' . ($body['message'] ?? 'Error'));
        }

        $paymentStatus = $body['payment_status'] ?? 'waiting';

        return [
            'status'              => $this->mapStatus($paymentStatus),
            'provider_payment_id' => (string) ($body['payment_id'] ?? $payment->provider_payment_id),
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
        if (!$signature || !$secret) return false;

        $payload = json_decode($rawBody, true);
        if (!is_array($payload)) return false;

        ksort($payload);
        $expected = hash_hmac('sha512', json_encode($payload), $secret);

        return hash_equals($expected, $signature);
    }

    public function parseWebhook(array $payload): ?array
    {
        $orderId = $payload['order_id'] ?? null;
        if (!$orderId) return null;

        return [
            'status'              => $this->mapStatus($payload['payment_status'] ?? 'waiting'),
            'provider_reference'  => $orderId,
            'provider_payment_id' => (string) ($payload['payment_id'] ?? ''),
            'amount_minor'        => isset($payload['price_amount'])
                ? (int) round(((float) $payload['price_amount']) * 100)
                : 0,
            'currency'            => strtoupper($payload['price_currency'] ?? 'USD'),
        ];
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
