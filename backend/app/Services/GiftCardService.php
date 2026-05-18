<?php

namespace App\Services;

use App\Models\User;
use App\Services\GiftCard\ReloadlyService;
use RuntimeException;

class GiftCardService
{
    public function __construct(
        private readonly ReloadlyService $reloadly,
    ) {}

    public function getProducts(string $countryCode = 'US'): array
    {
        return $this->reloadly->getProducts($countryCode);
    }

    public function getProduct(int $productId): array
    {
        return $this->reloadly->getProduct($productId);
    }

    /**
     * Purchase a gift card via Reloadly.
     * Returns delivery payload with pin, serial, etc.
     */
    public function purchase(
        User    $user,
        int     $productId,
        float   $denomination,
        string  $orderId,
        ?string $recipientEmail = null,
    ): array {
        if ($denomination <= 0) {
            throw new RuntimeException('Invalid denomination amount.');
        }

        $email  = $recipientEmail ?: $user->email;
        $result = $this->reloadly->placeOrder(
            productId:        $productId,
            unitPrice:        $denomination,
            recipientEmail:   $email,
            customIdentifier: 'ccodit-' . $orderId,
            senderName:       'C-codit',
        );

        return [
            'type'           => 'giftcard',
            'provider'       => 'reloadly',
            'transaction_id' => $result['transaction_id'],
            'product_name'   => $result['product_name'],
            'denomination'   => $denomination,
            'currency'       => 'USD',
            'pin'            => $result['pin'],
            'serial'         => $result['serial'],
            'info'           => $result['info'],
            'validity'       => $result['validity'],
            'expiry_date'    => $result['expiry_date'],
            'redemption_url' => $result['redemption_url'],
            'recipient_email'=> $email,
        ];
    }

    /**
     * Price in USD minor units (denomination + any sender fee from Reloadly).
     */
    public function getPrice(string $productCode, float $denomination, float $senderFeeUsd = 0.0): int
    {
        return (int) round(($denomination + $senderFeeUsd) * 100);
    }
}
