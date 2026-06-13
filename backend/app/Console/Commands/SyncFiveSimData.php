<?php

namespace App\Console\Commands;

use App\Models\FiveSimCountry;
use App\Models\FiveSimOperator;
use App\Models\FiveSimPrice;
use App\Models\FiveSimProduct;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncFiveSimData extends Command
{
    protected $signature = 'fivesim:sync';
    protected $description = 'Sync 5sim reference data (countries, products, operators, prices) from the bulk prices endpoint';

    private string $baseUrl = 'https://5sim.net/v1';

    public function handle()
    {
        $apiKey = config('services.fivesim.api_key');
        if (!$apiKey) {
            $this->error('FIVESIM_API_KEY not configured');
            return 1;
        }

        $this->info('Fetching all prices from 5sim API...');

        try {
            $res = Http::baseUrl($this->baseUrl)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Accept'        => 'application/json',
                ])
                ->timeout(60)
                ->get('/guest/prices');

            if (!$res->successful()) {
                $this->error('Failed to fetch prices: HTTP ' . $res->status());
                return 1;
            }

            // Response structure: {countryCode: {productCode: {operatorCode: {cost, count}}}}
            $body = $res->json() ?? [];
        } catch (\Throwable $e) {
            $this->error('Request failed: ' . $e->getMessage());
            return 1;
        }

        $this->info('Processing ' . count($body) . ' countries...');

        $countryCache  = [];
        $productCache  = [];
        $operatorCache = [];
        $priceCount    = 0;

        foreach ($body as $countryCode => $products) {
            if (!is_array($products)) continue;

            // Upsert country
            if (!isset($countryCache[$countryCode])) {
                $country = FiveSimCountry::updateOrCreate(
                    ['api_code' => $countryCode],
                    ['name' => ucwords(str_replace('_', ' ', $countryCode)), 'is_active' => true]
                );
                $countryCache[$countryCode] = $country->id;
            }
            $countryId = $countryCache[$countryCode];

            foreach ($products as $productCode => $operators) {
                if (!is_array($operators)) continue;

                // Upsert product
                if (!isset($productCache[$productCode])) {
                    $product = FiveSimProduct::updateOrCreate(
                        ['api_code' => $productCode],
                        ['name' => ucwords(str_replace('_', ' ', $productCode)), 'is_active' => true]
                    );
                    $productCache[$productCode] = $product->id;
                }
                $productId = $productCache[$productCode];

                foreach ($operators as $operatorCode => $priceData) {
                    if (!is_array($priceData)) continue;

                    $priceRub = (float) ($priceData['cost']  ?? 0);
                    $count    = (int)   ($priceData['count'] ?? 0);

                    if ($priceRub <= 0) continue;

                    // Upsert operator
                    $operatorKey = $countryId . ':' . $operatorCode;
                    if (!isset($operatorCache[$operatorKey])) {
                        $operator = FiveSimOperator::updateOrCreate(
                            ['country_id' => $countryId, 'api_code' => $operatorCode],
                            ['name' => ucwords(str_replace('_', ' ', $operatorCode)), 'is_active' => true]
                        );
                        $operatorCache[$operatorKey] = $operator->id;
                    }
                    $operatorId = $operatorCache[$operatorKey];

                    // Upsert price
                    FiveSimPrice::updateOrCreate(
                        [
                            'country_id'  => $countryId,
                            'product_id'  => $productId,
                            'operator_id' => $operatorId,
                        ],
                        [
                            'price_rub'       => $priceRub,
                            'available_count' => $count,
                            'last_fetched_at' => now(),
                        ]
                    );
                    $priceCount++;
                }
            }
        }

        $this->info('Sync complete:');
        $this->info('  Countries: ' . count($countryCache));
        $this->info('  Products:  ' . count($productCache));
        $this->info('  Operators: ' . count($operatorCache));
        $this->info('  Prices:    ' . $priceCount);

        Log::info('fivesim.sync.complete', [
            'countries' => count($countryCache),
            'products'  => count($productCache),
            'operators' => count($operatorCache),
            'prices'    => $priceCount,
        ]);

        return 0;
    }
}
