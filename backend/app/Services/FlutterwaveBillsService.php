<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Flutterwave Bills Payment API v3.
 * Docs: https://developer.flutterwave.com/reference/endpoints/bills
 *
 * Correct endpoint: POST /v3/bills
 * Correct biller codes from Flutterwave docs.
 */
class FlutterwaveBillsService
{
    private string $baseUrl = 'https://api.flutterwave.com/v3';
    private string $secretKey;

    public function __construct()
    {
        $this->secretKey = (string) config('services.flutterwave.secret_key');
    }

    private function post(string $path, array $data): array
    {
        Log::channel('payments')->info('flutterwave_bills.request', [
            'path' => $path,
            'data' => $data,
        ]);

        $res = Http::withToken($this->secretKey)
            ->acceptJson()
            ->post($this->baseUrl . $path, $data);

        Log::channel('payments')->info('flutterwave_bills.response', [
            'status' => $res->status(),
            'body'   => $res->json(),
        ]);

        if ($res->failed()) {
            $msg = $res->json('message') ?? $res->json('error') ?? 'HTTP ' . $res->status();
            Log::error('flutterwave_bills.http_error', [
                'path'   => $path,
                'status' => $res->status(),
                'body'   => $res->json(),
                'sent'   => $data,
            ]);
            throw new RuntimeException('Flutterwave Bills API error: ' . $msg);
        }

        $body = $res->json();
        if (($body['status'] ?? '') !== 'success') {
            Log::error('flutterwave_bills.api_failure', [
                'path'   => $path,
                'status' => $res->status(),
                'body'   => $body,
                'sent'   => $data,
            ]);
            throw new RuntimeException('Flutterwave Bills failed: ' . ($body['message'] ?? 'Unknown error'));
        }

        return $body['data'] ?? [];
    }

    private function get(string $path, array $query = []): array
    {
        $res = Http::withToken($this->secretKey)
            ->acceptJson()
            ->get($this->baseUrl . $path, $query);

        if ($res->failed()) {
            throw new RuntimeException('Flutterwave Bills API error: ' . ($res->json('message') ?? 'HTTP ' . $res->status()));
        }
        return $res->json('data') ?? [];
    }

    /**
     * Validate a customer before billing.
     * Returns customer name / account details.
     */
    public function validateCustomer(string $itemCode, string $customerId): array
    {
        return $this->get("/bill-items/{$itemCode}/validate", ['customer' => $customerId]);
    }

    /**
     * Buy airtime.
     * Flutterwave biller codes: MTN=BIL099, Airtel=BIL102, Glo=BIL103, 9mobile=BIL104
     */
    public function buyAirtime(string $phone, string $network, float $amount, string $txRef): array
    {
        $billerCodes = [
            'MTN'     => 'BIL099',
            'Airtel'  => 'BIL102',
            'Glo'     => 'BIL103',
            '9mobile' => 'BIL104',
        ];

        return $this->post('/bills', [
            'country'   => 'NG',
            'customer'  => $phone,
            'amount'    => (int) $amount,
            'type'      => 'AIRTIME',
            'reference' => $txRef,
            'biller_code' => $billerCodes[$network] ?? 'BIL099',
        ]);
    }

    /**
     * Buy data bundle.
     */
    public function buyData(string $phone, string $network, string $planCode, float $amount, string $txRef): array
    {
        $billerCodes = [
            'MTN'     => 'BIL108',
            'Airtel'  => 'BIL110',
            'Glo'     => 'BIL111',
            '9mobile' => 'BIL112',
        ];

        return $this->post('/bills', [
            'country'   => 'NG',
            'customer'  => $phone,
            'amount'    => (int) $amount,
            'type'      => 'DATA_BUNDLE',
            'reference' => $txRef,
            'biller_code' => $billerCodes[$network] ?? 'BIL108',
            'plan_code'   => $planCode,
        ]);
    }

    /**
     * Pay electricity bill (prepaid or postpaid).
     */
    public function payElectricity(string $meterNumber, string $disco, string $meterType, float $amount, string $txRef): array
    {
        // Prepaid biller codes
        $prepaidCodes = [
            'EKEDC'  => 'BIL136',
            'IKEDC'  => 'BIL137',
            'AEDC'   => 'BIL138',
            'PHEDC'  => 'BIL139',
            'EEDC'   => 'BIL140',
            'BEDC'   => 'BIL141',
            'KEDCO'  => 'BIL142',
        ];
        // Postpaid biller codes
        $postpaidCodes = [
            'EKEDC'  => 'BIL119',
            'IKEDC'  => 'BIL120',
            'AEDC'   => 'BIL121',
            'PHEDC'  => 'BIL122',
            'EEDC'   => 'BIL123',
            'BEDC'   => 'BIL124',
            'KEDCO'  => 'BIL125',
        ];

        $billerCode = $meterType === 'postpaid'
            ? ($postpaidCodes[$disco] ?? 'BIL119')
            : ($prepaidCodes[$disco]  ?? 'BIL136');

        return $this->post('/bills', [
            'country'     => 'NG',
            'customer'    => $meterNumber,
            'amount'      => (int) $amount,
            'type'        => 'POWER',
            'reference'   => $txRef,
            'biller_code' => $billerCode,
        ]);
    }

    /**
     * Validate electricity meter — returns customer name.
     */
    public function validateMeter(string $meterNumber, string $disco, string $meterType = 'prepaid'): array
    {
        $prepaidCodes = [
            'EKEDC' => 'BIL136', 'IKEDC' => 'BIL137', 'AEDC' => 'BIL138',
            'PHEDC' => 'BIL139', 'EEDC'  => 'BIL140', 'BEDC' => 'BIL141', 'KEDCO' => 'BIL142',
        ];
        $postpaidCodes = [
            'EKEDC' => 'BIL119', 'IKEDC' => 'BIL120', 'AEDC' => 'BIL121',
            'PHEDC' => 'BIL122', 'EEDC'  => 'BIL123', 'BEDC' => 'BIL124', 'KEDCO' => 'BIL125',
        ];
        $itemCode = $meterType === 'postpaid'
            ? ($postpaidCodes[$disco] ?? 'BIL119')
            : ($prepaidCodes[$disco]  ?? 'BIL136');

        return $this->validateCustomer($itemCode, $meterNumber);
    }

    /**
     * Pay TV subscription.
     */
    public function payTV(string $smartcardNumber, string $provider, string $txRef): array
    {
        $billerCodes = [
            'DSTV'      => 'BIL119',
            'GOtv'      => 'BIL120',
            'Showmax'   => 'BIL121',
            'StarTimes' => 'BIL122',
        ];

        return $this->post('/bills', [
            'country'     => 'NG',
            'customer'    => $smartcardNumber,
            'amount'      => 0,
            'type'        => 'CABLE',
            'reference'   => $txRef,
            'biller_code' => $billerCodes[$provider] ?? 'BIL119',
        ]);
    }
}
