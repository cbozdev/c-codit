<?php

namespace App\Services\Payment;

use App\Enums\PaymentProvider;
use Illuminate\Support\Facades\Log;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Models\User;
use App\Services\Payment\Contracts\PaymentGateway;
use App\Services\Support\ExternalHttp;
use App\Support\Money;
use Illuminate\Support\Str;
use RuntimeException;

class FlutterwaveService implements PaymentGateway
{
    public function providerCode(): string { return PaymentProvider::FLUTTERWAVE->value; }

    public function initiate(User $user, Money $amount, string $idempotencyKey, array $options = []): Payment
    {
        if ($existing = Payment::where('idempotency_key', $idempotencyKey)->first()) {
            return $existing;
        }

        $txRef = 'ccd-'.strtolower((string) Str::ulid());

        $payload = [
            'tx_ref'          => $txRef,
            'amount'          => $amount->toDecimal(),
            'currency'        => $amount->currency,
            'payment_options' => 'card,banktransfer,ussd,credit',
            'redirect_url'    => rtrim((string) config('app.frontend_url'), '/').'/wallet/confirm',
            'customer' => [
                'email'       => $user->email,
                'name'        => $user->name,
                'phonenumber' => $user->phone,
            ],
            'customizations' => [
                'title'       => config('app.name'),
                'description' => $options['description'] ?? 'Wallet funding',
                'logo'        => rtrim((string) config('app.frontend_url'), '/').'/favicon.svg',
            ],
            'meta' => [
                'user_public_id' => $user->public_id,
                'purpose'        => $options['purpose'] ?? 'wallet_fund',
            ],
        ];

        $res = ExternalHttp::for('flutterwave', config('services.flutterwave.base_url'))
            ->withToken(config('services.flutterwave.secret_key'))
            ->post('/payments', $payload);

        $body = ExternalHttp::ensureSuccessful($res, 'flutterwave.initiate');

        if (($body['status'] ?? null) !== 'success' || empty($body['data']['link'])) {
            throw new RuntimeException('Flutterwave did not return a payment link.');
        }

        return Payment::create([
            'user_id'            => $user->id,
            'provider'           => PaymentProvider::FLUTTERWAVE->value,
            'provider_reference' => $txRef,
            'status'             => PaymentStatus::INITIATED->value,
            'amount_minor'       => $amount->amountMinor,
            'currency'           => $amount->currency,
            'checkout_url'       => $body['data']['link'],
            'idempotency_key'    => $idempotencyKey,
            'request_payload'    => $payload,
            'response_payload'   => $body,
            'expires_at'         => now()->addHours(2),
        ]);
    }

    public function verifyWebhook(string $rawBody, array $headers): bool
    {
        // Flutterwave sends the secret as 'verif-hash' header
        // Try all possible capitalisation/format variations
        $header = $headers['verif-hash'][0]
            ?? $headers['verif_hash'][0]
            ?? $headers['Verif-Hash'][0]
            ?? $headers['VERIF-HASH'][0]
            ?? null;

        $expected = (string) config('services.flutterwave.webhook_secret');

        Log::channel('webhooks')->info('flutterwave.signature_check', [
            'header_found'    => $header !== null,
            'header_value'    => $header ? substr((string)$header, 0, 8).'...' : null,
            'expected_length' => strlen($expected),
            'actual_length'   => $header ? strlen((string)$header) : 0,
        ]);

        if (! $header || $expected === '') {
            return false;
        }

        return hash_equals($expected, (string) $header);
    }

    public function parseWebhook(array $payload): ?array
    {
        $data = $payload['data'] ?? [];
        if (empty($data['tx_ref'])) return null;
        return [
            'status'              => $this->mapStatus($data['status'] ?? ''),
            'provider_reference'  => $data['tx_ref'],
            'provider_payment_id' => isset($data['id']) ? (string) $data['id'] : null,
            'event'               => $payload['event'] ?? null,
        ];
    }

    public function verifyPayment(string $providerReference): array
    {
        $res = ExternalHttp::for('flutterwave', config('services.flutterwave.base_url'))
            ->withToken(config('services.flutterwave.secret_key'))
            ->get('/transactions/verify_by_reference', ['tx_ref' => $providerReference]);

        $body = ExternalHttp::ensureSuccessful($res, 'flutterwave.verify');
        $data = $body['data'] ?? [];

        return [
            'status'              => $this->mapStatus($data['status'] ?? ''),
            'amount_minor'        => (int) round(((float) ($data['amount'] ?? 0)) * 100),
            'currency'            => strtoupper((string) ($data['currency'] ?? '')),
            'provider_payment_id' => isset($data['id']) ? (string) $data['id'] : null,
            'raw'                 => $data,
        ];
    }

    private function mapStatus(string $s): string
    {
        return match (strtolower($s)) {
            'successful', 'success' => 'success',
            'failed', 'cancelled'   => 'failed',
            default                 => 'pending',
        };
    }
}
