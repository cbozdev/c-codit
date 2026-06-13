<?php

namespace App\Console\Commands;

use App\Models\FiveSimCountry;
use App\Models\FiveSimOperator;
use App\Models\FiveSimProduct;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncFiveSimData extends Command
{
    protected $signature = 'fivesim:sync {--countries} {--products} {--operators} {--prices}';
    protected $description = 'Sync 5sim reference data (countries, products, operators, prices) from their API';

    private string $baseUrl = 'https://5sim.net/v1';
    private string $apiKey;

    public function handle()
    {
        $this->apiKey = config('services.fivesim.api_key');
        if (!$this->apiKey) {
            $this->error('FIVESIM_API_KEY not configured');
            return 1;
        }

        $options = $this->options();
        $all = !($options['countries'] || $options['products'] || $operators = $options['operators'] || $options['prices']);

        if ($all || $options['countries']) $this->syncCountries();
        if ($all || $options['products']) $this->syncProducts();
        if ($all || $options['operators']) $this->syncOperators();
        if ($all || $options['prices']) $this->syncPrices();

        $this->info('5sim data sync complete');
        return 0;
    }

    private function client()
    {
        return Http::baseUrl($this->baseUrl)
            ->withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Accept' => 'application/json',
            ])
            ->timeout(30);
    }

    private function syncCountries(): void
    {
        $this->info('Syncing countries...');
        try {
            $res = $this->client()->get('/guest/countries');
            if (!$res->successful()) {
                $this->error('Failed to fetch countries: ' . $res->status());
                return;
            }

            $body = $res->json();
            $countries = is_array($body) ? $body : ($body['countries'] ?? $body['data'] ?? []);

            $created = 0;
            $updated = 0;

            foreach ($countries as $apiCode => $countryName) {
                if (is_array($countryName)) {
                    $name = $countryName['name'] ?? $apiCode;
                } else {
                    $name = $countryName;
                }

                FiveSimCountry::updateOrCreate(
                    ['api_code' => $apiCode],
                    ['name' => $name, 'is_active' => true]
                ) ? $updated++ : $created++;
            }

            $this->info("Countries sync: {$created} created, {$updated} updated");
        } catch (\Throwable $e) {
            $this->error('Error syncing countries: ' . $e->getMessage());
            Log::error('fivesim.sync.countries.error', ['error' => $e->getMessage()]);
        }
    }

    private function syncProducts(): void
    {
        $this->info('Syncing products...');
        try {
            $res = $this->client()->get('/guest/products');
            if (!$res->successful()) {
                $this->error('Failed to fetch products: ' . $res->status());
                return;
            }

            $body = $res->json();
            $products = is_array($body) ? $body : ($body['products'] ?? $body['data'] ?? []);

            $created = 0;
            $updated = 0;

            foreach ($products as $apiCode => $productName) {
                if (is_array($productName)) {
                    $name = $productName['name'] ?? $apiCode;
                    $serviceId = $productName['id'] ?? null;
                } else {
                    $name = $productName;
                    $serviceId = null;
                }

                FiveSimProduct::updateOrCreate(
                    ['api_code' => $apiCode],
                    ['name' => $name, 'service_id' => $serviceId, 'is_active' => true]
                ) ? $updated++ : $created++;
            }

            $this->info("Products sync: {$created} created, {$updated} updated");
        } catch (\Throwable $e) {
            $this->error('Error syncing products: ' . $e->getMessage());
            Log::error('fivesim.sync.products.error', ['error' => $e->getMessage()]);
        }
    }

    private function syncOperators(): void
    {
        $this->info('Syncing operators...');

        $countries = FiveSimCountry::where('is_active', true)->get();
        $products = FiveSimProduct::where('is_active', true)->get();
        $total = 0;

        foreach ($countries as $country) {
            foreach ($products as $product) {
                try {
                    $res = $this->client()->get(
                        "/guest/products/{$country->api_code}/{$product->api_code}"
                    );

                    if (!$res->successful()) continue;

                    $body = $res->json();
                    $operators = $body['operators'] ?? $body ?? [];

                    foreach ($operators as $operatorData) {
                        if (is_array($operatorData)) {
                            $apiCode = $operatorData['code'] ?? $operatorData['id'] ?? null;
                            $name = $operatorData['name'] ?? $apiCode;
                        } else {
                            $apiCode = (string) $operatorData;
                            $name = $apiCode;
                        }

                        if (!$apiCode) continue;

                        FiveSimOperator::updateOrCreate(
                            ['country_id' => $country->id, 'api_code' => $apiCode],
                            ['name' => $name, 'is_active' => true]
                        );
                        $total++;
                    }
                } catch (\Throwable) {
                    // Skip on error for this product/country combo
                }
            }
        }

        $this->info("Operators sync: {$total} processed");
    }

    private function syncPrices(): void
    {
        $this->info('Syncing prices (this may take a while)...');
        try {
            $res = $this->client()->get('/guest/prices');
            if (!$res->successful()) {
                $this->error('Failed to fetch prices: ' . $res->status());
                return;
            }

            $body = $res->json();
            $upserted = 0;

            // Expected structure: {country: {product: {operator: {cost, count}}}}
            foreach ($body as $countryCode => $products) {
                $country = FiveSimCountry::where('api_code', $countryCode)->first();
                if (!$country) continue;

                foreach ($products as $productCode => $operators) {
                    $product = FiveSimProduct::where('api_code', $productCode)->first();
                    if (!$product) continue;

                    foreach ($operators as $operatorCode => $priceData) {
                        $operator = FiveSimOperator::where('country_id', $country->id)
                            ->where('api_code', $operatorCode)
                            ->first();
                        if (!$operator) continue;

                        $priceRub = (float) ($priceData['cost'] ?? 0);
                        $count = (int) ($priceData['count'] ?? 0);

                        if ($priceRub > 0) {
                            \App\Models\FiveSimPrice::updateOrCreate(
                                [
                                    'country_id' => $country->id,
                                    'product_id' => $product->id,
                                    'operator_id' => $operator->id,
                                ],
                                [
                                    'price_rub' => $priceRub,
                                    'available_count' => $count,
                                    'last_fetched_at' => now(),
                                ]
                            );
                            $upserted++;
                        }
                    }
                }
            }

            $this->info("Prices sync: {$upserted} entries upserted");
        } catch (\Throwable $e) {
            $this->error('Error syncing prices: ' . $e->getMessage());
            Log::error('fivesim.sync.prices.error', ['error' => $e->getMessage()]);
        }
    }
}
