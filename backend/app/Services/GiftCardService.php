<?php

namespace App\Services;

use RuntimeException;

/**
 * Gift Card Service.
 *
 * Currently operates in "manual fulfillment" mode — orders are recorded
 * and fulfilled by admin. When you integrate a gift card API provider
 * (e.g. Reloadly, CardSwap), replace the purchase() method body.
 */
class GiftCardService
{
    /**
     * Process a gift card order.
     * In production, integrate Reloadly or CardSwap API here.
     */
    public function purchase(string $productCode, float $denomination, string $currency = 'USD'): array
    {
        // TODO: Integrate with Reloadly API (https://developers.reloadly.com)
        // For now, returns a pending order for manual fulfillment.
        // The order will appear in admin panel for you to manually deliver the code.

        return [
            'provider_order_id' => 'GC-MANUAL-' . strtoupper(substr(md5(uniqid()), 0, 10)),
            'status'            => 'pending_fulfillment',
            'product'           => $productCode,
            'denomination'      => $denomination,
            'currency'          => $currency,
            'delivery_method'   => 'manual_email',
            'note'              => 'Gift card will be delivered to your registered email within 24 hours.',
        ];
    }

    /**
     * Get price for a gift card.
     * Returns price in USD minor units.
     */
    public function getPrice(string $productCode, float $denomination): int
    {
        // Add a 5% processing fee on top of denomination
        $processingFee = 1.05;
        return (int) round($denomination * $processingFee * 100);
    }
}
