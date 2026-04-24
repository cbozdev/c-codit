<?php

namespace App\Services;

use App\Services\Support\ExternalHttp;
use RuntimeException;

/**
 * Flutterwave Bills Payment API.
 * Handles airtime, data, electricity, TV subscriptions.
 * Docs: https://developer.flutterwave.com/docs/collecting-payments/bills
 */
class FlutterwaveBillsService
{
    private function client()
    {
        return ExternalHttp::for('flutterwave_bills', config('services.flutterwave.base_url'))
            ->withToken(config('services.flutterwave.secret_key'));
    }

    /**
     * Get available bill categories and billers.
     */
    public function getBillers(string $category): array
    {
        $res = $this->client()->get('/bill-categories', ['type' => $category]);
        $body = ExternalHttp::ensureSuccessful($res, 'flutterwave_bills.categories');
        return $body['data'] ?? [];
    }

    /**
     * Validate a customer (meter number, smartcard, phone number).
     */
    public function validateCustomer(string $itemCode, string $customerId, string $code = 'BIL136'): array
    {
        $res = $this->client()->get('/bill-items/' . $itemCode . '/validate', [
            'code' => $code,
            'customer' => $customerId,
        ]);
        $body = ExternalHttp::ensureSuccessful($res, 'flutterwave_bills.validate');
        return $body['data'] ?? [];
    }

    /**
     * Pay a bill.
     * Returns: ['status' => 'success'|'failed', 'tx_ref' => ..., 'amount' => ...]
     */
    public function payBill(array $params): array
    {
        $res = $this->client()->post('/bills', $params);
        $body = ExternalHttp::ensureSuccessful($res, 'flutterwave_bills.pay');

        if (($body['status'] ?? '') !== 'success') {
            throw new RuntimeException('Bill payment failed: ' . ($body['message'] ?? 'Unknown error'));
        }

        return $body['data'] ?? [];
    }

    /**
     * Get bill categories for a specific type.
     * Types: AIRTIME, DATA_BUNDLE, POWER, CABLE, INTERNET
     */
    public function getAirtimeBillers(): array
    {
        return $this->getBillers('AIRTIME');
    }

    /**
     * Buy airtime.
     */
    public function buyAirtime(string $phone, string $network, float $amount, string $txRef): array
    {
        // Network codes: MTN=BIL099, Airtel=BIL102, Glo=BIL103, 9mobile=BIL104
        $networkCodes = [
            'MTN'     => 'BIL099',
            'Airtel'  => 'BIL102',
            'Glo'     => 'BIL103',
            '9mobile' => 'BIL104',
        ];

        $code = $networkCodes[$network] ?? 'BIL099';

        return $this->payBill([
            'country'    => 'NG',
            'customer'   => $phone,
            'amount'     => $amount,
            'type'       => 'AIRTIME',
            'reference'  => $txRef,
            'code'       => $code,
        ]);
    }

    /**
     * Buy data bundle.
     */
    public function buyData(string $phone, string $network, string $itemCode, string $txRef): array
    {
        return $this->payBill([
            'country'    => 'NG',
            'customer'   => $phone,
            'amount'     => 0, // Amount is determined by the data plan
            'type'       => 'DATA_BUNDLE',
            'reference'  => $txRef,
            'code'       => $itemCode,
        ]);
    }

    /**
     * Pay electricity bill.
     */
    public function payElectricity(string $meterNumber, string $disco, float $amount, string $txRef): array
    {
        // DISCO codes
        $discoCodes = [
            'EKEDC'  => 'BIL136',
            'IKEDC'  => 'BIL137',
            'AEDC'   => 'BIL138',
            'PHEDC'  => 'BIL139',
            'EEDC'   => 'BIL140',
            'BEDC'   => 'BIL141',
            'KEDCO'  => 'BIL142',
        ];

        $code = $discoCodes[$disco] ?? 'BIL136';

        return $this->payBill([
            'country'    => 'NG',
            'customer'   => $meterNumber,
            'amount'     => $amount,
            'type'       => 'POWER',
            'reference'  => $txRef,
            'code'       => $code,
        ]);
    }

    /**
     * Pay TV subscription (DSTV/GOtv).
     */
    public function payTV(string $smartcardNumber, string $provider, string $plan, string $txRef): array
    {
        $providerCodes = [
            'DSTV'     => 'BIL119',
            'GOtv'     => 'BIL120',
            'Showmax'  => 'BIL121',
            'StarTimes'=> 'BIL122',
        ];

        $code = $providerCodes[$provider] ?? 'BIL119';

        return $this->payBill([
            'country'    => 'NG',
            'customer'   => $smartcardNumber,
            'amount'     => 0,
            'type'       => 'CABLE',
            'reference'  => $txRef,
            'code'       => $code,
            'plan'       => $plan,
        ]);
    }
}
