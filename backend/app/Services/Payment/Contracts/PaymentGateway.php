<?php

namespace App\Services\Payment\Contracts;

use App\Models\Payment;
use App\Models\User;
use App\Support\Money;

interface PaymentGateway
{
    /**
     * Initiate a payment. Returns a Payment row in "initiated" state with
     * provider_reference / checkout_url / pay_address populated.
     */
    public function initiate(
        User $user,
        Money $amount,
        string $idempotencyKey,
        array $options = [],
    ): Payment;

    /**
     * Verify a webhook signature against the raw request body.
     */
    public function verifyWebhook(string $rawBody, array $headers): bool;

    /**
     * Parse a webhook payload and return either:
     *   ['status' => 'success', 'provider_reference' => ..., 'amount_minor' => ..., 'currency' => ...]
     *   ['status' => 'failed',  'provider_reference' => ..., 'reason' => '...']
     *   ['status' => 'pending', 'provider_reference' => ...]
     *   or null if the event is irrelevant.
     */
    public function parseWebhook(array $payload): ?array;

    /**
     * Authoritative verification with the provider's API. Never trust the
     * webhook body alone for crediting wallets — we re-fetch here.
     */
    public function verifyPayment(string $providerReference): array;

    public function providerCode(): string;
}
