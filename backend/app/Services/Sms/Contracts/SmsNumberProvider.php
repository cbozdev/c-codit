<?php

namespace App\Services\Sms\Contracts;

use App\Support\Money;

interface SmsNumberProvider
{
    /** Return price in USD minor units for the requested service+country. */
    public function getPrice(string $service, string $country): ?Money;

    /** Check availability. */
    public function isAvailable(string $service, string $country): bool;

    /**
     * Buy a number. Returns a normalised payload:
     *   [
     *     'provider_order_id' => '...',
     *     'phone_number'      => '+...',
     *     'expires_at'        => ISO string | null,
     *     'raw'               => provider response
     *   ]
     */
    public function purchase(string $service, string $country): array;

    /** Cancel / refund an unused order at the provider. */
    public function cancel(string $providerOrderId): bool;

    /** Poll for SMS code. Returns the code string or null. */
    public function fetchCode(string $providerOrderId): ?string;

    public function code(): string;
}
