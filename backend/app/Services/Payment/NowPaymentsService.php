<?php

namespace App\Services\Payment;

use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Models\User;
use App\Services\Payment\Contracts\PaymentGateway;
use App\Services\Support\ExternalHttp;
use App\Support\Money;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * NowPayments IPN signature: HMAC-SHA512 of the JSON-serialized, key-sorted
 * payload using the IPN secret. The provider sends the signature in the
 * "x-nowpayments-sig" header.
 */
class NowPaymentsService implements PaymentGateway
{
    public function providerCode(): string { return PaymentProvider::NOWPAYMENTS->value; }

    public function initiate(User $user, Money $amount, string $idempotencyKey, array $options = []): Payment
    {
        if ($existing = Payment::where('idempotency_key', $idempotencyKey)->first()) {
            return $existing;
        }

        $orderId = 'ccd-'.strtolower((string) Str::ulid());

        $payload = [
            'price_amount'     => (float) $amount->toDecimal(),
            'price_currency'   => strtolower($amount->currency),
            'pay_currency'     => strtolower($options['pay_currency'] ?? 'usdt'),
            'order_id'         => $orderId,
            'order_description'=> $options['description'] ?? 'Wallet funding',
            'ipn_callback_url' => rtrim((string) config('app.url'), '/').'/api/v1/webhooks/nowpayments',
            'success_url'      => rtrim((string) config('app.frontend_url'), '/').'/wallet/confirm',
            'cancel_url'       => rtrim((string) config('app.frontend_url'), '/').'/wallet',
        ];

        $res = ExternalHttp::for('nowpayments', config('services.nowpayments.base_url'))
            ->withHeaders(['x-api-key' => (string) config('services.nowpayments.api_key')])
            ->post('/invoice', $payload);

        $body = ExternalHttp::ensureSuccessful($res, 'nowpayments.initiate');
        if (empty($body['id']) || empty($body['invoice_url'])) {
            throw new RuntimeException('NowPayments did not return an invoice URL.');
        }

        return Payment::create([
            'user_id'               => $user->id,
            'provider'              => PaymentProvider::NOWPAYMENTS->value,
            'provider_reference'    => $orderId,
            'provider_payment_id'   => (string) $body['id'],
            'status'                => PaymentStatus::INITIATED->value,
            'amount_minor'          => $amount->amountMinor,
            'currency'              => $amount->currency,
            'pay_currency'          => $payload['pay_currency'],
            'checkout_url'          => $body['invoice_url'],
            'requested_amount_minor'=> $amount->amountMinor,
            'requested_currency'    => $amount->currency,
            'idempotency_key'       => $idempotencyKey,
            'request_payload'       => $payload,
            'response_payload'      => $body,
            'expires_at'            => now()->addHour(),
        ]);
    }

    public function verifyWebhook(string $rawBody, array $headers): bool
    {
        $sig = $headers['x-nowpayments-sig'][0] ?? $headers['X-Nowpayments-Sig'][0] ?? null;
        if (! $sig) return false;
        $secret = (string) config('services.nowpayments.ipn_secret');
        if ($secret === '') return false;

        $decoded = json_decode($rawBody, true);
        if (! is_array($decoded)) return false;

        // Sort keys recursively before signing (NowPayments requirement).
        $sorted = $this->ksortRecursive($decoded);
        $expected = hash_hmac('sha512', json_encode($sorted, JSON_UNESCAPED_SLASHES), $secret);

        return hash_equals($expected, (string) $sig);
    }

    public function parseWebhook(array $payload): ?array
    {
        $orderId = $payload['order_id'] ?? null;
        if (! $orderId) return null;

        return [
            'status'              => $this->mapStatus($payload['payment_status'] ?? ''),
            'provider_reference'  => (string) $orderId,
            'provider_payment_id' => isset($payload['payment_id']) ? (string) $payload['payment_id'] : null,
            'amount_minor'        => isset($payload['price_amount'])
                ? (int) round(((float) $payload['price_amount']) * 100)
                : null,
            'currency'            => isset($payload['price_currency']) ? strtoupper((string) $payload['price_currency']) : null,
        ];
    }

    public function verifyPayment(string $providerReference): array
    {
        // For NowPayments, authoritative check is by payment_id; we use the stored one.
        $payment = Payment::where('provider_reference', $providerReference)
            ->where('provider', PaymentProvider::NOWPAYMENTS->value)
            ->firstOrFail();

        $res = ExternalHttp::for('nowpayments', config('services.nowpayments.base_url'))
            ->withHeaders(['x-api-key' => (string) config('services.nowpayments.api_key')])
            ->get('/payment/'.$payment->provider_payment_id);

        $body = ExternalHttp::ensureSuccessful($res, 'nowpayments.verify');

        return [
            'status'              => $this->mapStatus($body['payment_status'] ?? ''),
            'amount_minor'        => isset($body['price_amount'])
                ? (int) round(((float) $body['price_amount']) * 100)
                : null,
            'currency'            => isset($body['price_currency']) ? strtoupper((string) $body['price_currency']) : null,
            'provider_payment_id' => (string) ($body['payment_id'] ?? $payment->provider_payment_id),
            'raw'                 => $body,
        ];
    }

    private function mapStatus(string $s): string
    {
        return match (strtolower($s)) {
            'finished', 'confirmed'             => 'success',
            'failed', 'refunded', 'expired'     => 'failed',
            default                             => 'pending',
        };
    }

    private function ksortRecursive(array $a): array
    {
        ksort($a);
        foreach ($a as &$v) {
            if (is_array($v)) $v = $this->ksortRecursive($v);
        }
        return $a;
    }
}
