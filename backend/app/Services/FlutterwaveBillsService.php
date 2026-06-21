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
     *
     * Flutterwave Nigeria airtime biller codes (from bill-categories catalog):
     *   MTN=BIL099, Airtel=BIL102, Glo=BIL103, 9mobile=BIL104
     *
     * Phone number: local (08012345678) or international (+2348012345678) both accepted.
     * Minimum: ₦50 (enforced upstream in ServicePurchaseService).
     */
    public function buyAirtime(string $phone, string $network, float $amount, string $txRef): array
    {
        $billerCodes = [
            'MTN'     => 'BIL099',
            'Airtel'  => 'BIL102',
            'Glo'     => 'BIL103',
            '9mobile' => 'BIL104',
        ];

        // Normalise phone to Nigerian local format (08xxxxxxxxx)
        $phone = $this->normaliseNigerianPhone($phone);

        return $this->post('/bills', [
            'country'     => 'NG',
            'customer'    => $phone,
            'amount'      => (int) $amount,
            'recurrence'  => 'ONCE',
            'type'        => 'AIRTIME',
            'reference'   => $txRef,
            'biller_code' => $billerCodes[$network] ?? 'BIL099',
        ]);
    }

    /**
     * Fetch available data bundle plans for a network from Flutterwave's catalog.
     * Returns array of {item_code, biller_code, name, amount} sorted by amount.
     *
     * 9mobile was formerly "Etisalat" — Flutterwave's catalog still uses both names,
     * so we match on either keyword.
     */
    public function getDataPlans(string $network): array
    {
        // Primary search keyword per network (matched against item short_name/name)
        $keywords = [
            'MTN'     => ['mtn'],
            'Airtel'  => ['airtel'],
            'Glo'     => ['glo'],
            '9mobile' => ['9mobile', 'etisalat'],   // legacy brand still in catalog
        ];
        $keywords = $keywords[$network] ?? [strtolower($network)];

        // Flutterwave's /bill-categories?type=data_bundle returns ALL 290+ bill categories,
        // not just data bundles — the type filter is broken on their end. We whitelist
        // only known data billers (electricity, school fees, church offerings etc. pollute
        // the catalog under other biller codes):
        //   BIL108 = MTN data — NOT yet enabled on this merchant account (contact Flutterwave)
        //   BIL109 = Glo data — NOT yet enabled on this merchant account (contact Flutterwave)
        //   BIL110 = Airtel data (confirmed working)
        //   BIL111 = 9mobile data (confirmed working)
        $validDataBillers = ['BIL110', 'BIL111'];

        try {
            $res = Http::withToken($this->secretKey)
                ->acceptJson()
                ->get($this->baseUrl . '/bill-categories', [
                    'country' => 'NG',
                    'type'    => 'data_bundle',
                ]);

            Log::channel('payments')->info('flutterwave_bills.data_plans_raw', [
                'network'      => $network,
                'keywords'     => $keywords,
                'status'       => $res->status(),
                'sample_items' => array_slice($res->json('data') ?? [], 0, 5),
                'total_items'  => count($res->json('data') ?? []),
            ]);

            if ($res->failed()) return [];

            $items = $res->json('data') ?? [];
            $plans = [];
            foreach ($items as $item) {
                if (empty($item['item_code'])) continue;

                // Skip any item not from a whitelisted data biller (removes electricity,
                // school fees, SME/corporate broadband plans, etc. that pollute the catalog)
                if (! in_array($item['biller_code'] ?? '', $validDataBillers, true)) continue;

                $name = strtolower($item['short_name'] ?? $item['name'] ?? '');

                // Must match network keyword
                $matched = false;
                foreach ($keywords as $kw) {
                    if (str_contains($name, $kw)) { $matched = true; break; }
                }
                if (! $matched) continue;

                $plans[] = [
                    'item_code'   => $item['item_code'],
                    'biller_code' => $item['biller_code'],
                    'name'        => $item['short_name'] ?? $item['name'] ?? $item['item_code'],
                    'amount'      => (int) ($item['amount'] ?? 0),
                ];
            }
            usort($plans, fn ($a, $b) => $a['amount'] <=> $b['amount']);
            return $plans;
        } catch (\Throwable $e) {
            Log::channel('payments')->error('flutterwave_bills.data_plans_exception', ['error' => $e->getMessage()]);
            return [];
        }
    }

    /**
     * Buy data bundle using item_code + biller_code from getDataPlans().
     * Both item_code and biller_code must come from the fetched plan list.
     */
    public function buyData(string $phone, string $network, string $itemCode, string $billerCode, float $amount, string $txRef): array
    {
        if (empty($itemCode)) {
            throw new \RuntimeException('Data purchase requires a plan selection. Please pick a plan and try again.');
        }

        // Resolve biller code by network — from catalog analysis:
        //   BIL108 = MTN, BIL109 = Glo, BIL110 = Airtel, BIL111 = 9mobile
        $billerCodes = [
            'mtn'      => 'BIL108',
            'glo'      => 'BIL109',
            'airtel'   => 'BIL110',
            '9mobile'  => 'BIL111',
            'etisalat' => 'BIL111',
        ];
        $resolvedBillerCode = $billerCodes[strtolower($network)] ?? $billerCode;

        $phone = $this->normaliseNigerianPhone($phone);

        return $this->post('/bills', [
            'country'     => 'NG',
            'customer'    => $phone,
            'amount'      => (int) $amount,
            'recurrence'  => 'ONCE',
            'type'        => 'DATA_BUNDLE',
            'reference'   => $txRef,
            'biller_code' => $resolvedBillerCode,
            'item_code'   => $itemCode,
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
            'recurrence'  => 'ONCE',
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
     * Fetch available TV subscription plans for a provider from Flutterwave's catalog.
     * Returns array of {item_code, biller_code, name, amount} sorted by amount.
     */
    public function getTVPlans(string $provider): array
    {
        $keywords = [
            'DSTV'      => 'dstv',
            'GOtv'      => 'gotv',
            'Showmax'   => 'showmax',
            'StarTimes' => 'startimes',
        ];
        $keyword = $keywords[$provider] ?? strtolower($provider);

        try {
            $res = Http::withToken($this->secretKey)
                ->acceptJson()
                ->get($this->baseUrl . '/bill-categories', [
                    'country' => 'NG',
                    'type'    => 'cable_tv',
                ]);

            Log::channel('payments')->info('flutterwave_bills.tv_plans_raw', [
                'provider'     => $provider,
                'keyword'      => $keyword,
                'status'       => $res->status(),
                'sample_items' => array_slice($res->json('data') ?? [], 0, 5),
                'total_items'  => count($res->json('data') ?? []),
            ]);

            if ($res->failed()) return [];

            $items = $res->json('data') ?? [];
            $plans = [];
            foreach ($items as $item) {
                if (empty($item['item_code'])) continue;
                $name = strtolower($item['short_name'] ?? $item['name'] ?? '');
                if (! str_contains($name, $keyword)) {
                    continue;
                }
                $plans[] = [
                    'item_code'   => $item['item_code'],
                    'biller_code' => $item['biller_code'] ?? '',
                    'name'        => $item['short_name'] ?? $item['name'] ?? $item['item_code'],
                    'amount'      => (int) ($item['amount'] ?? 0),
                ];
            }
            usort($plans, fn ($a, $b) => $a['amount'] <=> $b['amount']);
            return $plans;
        } catch (\Throwable $e) {
            Log::channel('payments')->error('flutterwave_bills.tv_plans_exception', ['error' => $e->getMessage()]);
            return [];
        }
    }

    /**
     * Validate a TV smartcard number for the given plan's biller.
     * Returns customer name / account details.
     */
    public function validateSmartcard(string $smartcardNumber, string $itemCode): array
    {
        return $this->validateCustomer($itemCode, $smartcardNumber);
    }

    /**
     * Pay TV subscription.
     * Requires a plan selected via getTVPlans() — item_code, biller_code, and amount
     * must all come from the fetched plan so the right subscription is purchased.
     */
    public function payTV(string $smartcardNumber, string $provider, string $itemCode, string $billerCode, float $amount, string $txRef): array
    {
        if (empty($billerCode) || empty($itemCode)) {
            throw new \RuntimeException('TV subscription requires a plan selection. Please pick a plan and try again.');
        }

        return $this->post('/bills', [
            'country'     => 'NG',
            'customer'    => $smartcardNumber,
            'amount'      => (int) $amount,
            'recurrence'  => 'ONCE',
            'type'        => 'CABLE',
            'reference'   => $txRef,
            'biller_code' => $billerCode,
            'item_code'   => $itemCode,
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Normalise a Nigerian phone number to local 11-digit format (0XXXXXXXXXX).
     * Accepts: 08012345678 · 8012345678 · +2348012345678 · 2348012345678
     */
    private function normaliseNigerianPhone(string $phone): string
    {
        $phone = preg_replace('/\D/', '', $phone); // strip non-digits

        if (str_starts_with($phone, '234') && strlen($phone) === 13) {
            return '0' . substr($phone, 3); // +234XXXXXXXXXX → 0XXXXXXXXXX
        }
        if (strlen($phone) === 10 && ! str_starts_with($phone, '0')) {
            return '0' . $phone;            // 8012345678 → 08012345678
        }
        return $phone; // already 0XXXXXXXXXX or unrecognised — pass through
    }
}
