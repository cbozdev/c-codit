<?php

namespace App\Http\Controllers\Api\V1;

use App\Console\Commands\SyncFiveSimData;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

class FiveSimController extends Controller
{
    /**
     * Sync 5sim reference data (countries, products, operators).
     * This endpoint allows seeding the database via HTTP rather than CLI.
     * Only accessible to admins.
     */
    public function sync(Request $request)
    {
        // Only allow specific sync types
        $options = $request->validate([
            'countries' => 'nullable|boolean',
            'products' => 'nullable|boolean',
            'operators' => 'nullable|boolean',
            'prices' => 'nullable|boolean',
        ]);

        try {
            $command = new SyncFiveSimData();
            $input = new ArrayInput($options);
            $output = new BufferedOutput();

            // Run the command
            $command->run($input, $output);

            return response()->json([
                'success' => true,
                'message' => '5sim data sync completed',
                'output' => $output->fetch(),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Sync failed: ' . $e->getMessage(),
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get list of available countries and products.
     * Public endpoint for frontend to use when building service selection dropdowns.
     */
    public function getCountries()
    {
        $countries = \App\Models\FiveSimCountry::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'api_code', 'name', 'iso_code', 'phone_prefix'])
            ->toArray();

        return response()->json([
            'success' => true,
            'count' => count($countries),
            'data' => $countries,
        ]);
    }

    public function getProducts()
    {
        $products = \App\Models\FiveSimProduct::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'api_code', 'name', 'description'])
            ->toArray();

        return response()->json([
            'success' => true,
            'count' => count($products),
            'data' => $products,
        ]);
    }

    /**
     * Get prices for a specific product across all countries.
     */
    public function getPricesByProduct($productCode)
    {
        $product = \App\Models\FiveSimProduct::where('api_code', $productCode)->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found',
            ], 404);
        }

        $prices = \App\Models\FiveSimPrice::where('product_id', $product->id)
            ->where('available_count', '>', 0)
            ->with(['country', 'operator'])
            ->get();

        // Group by country and get the best price
        $byCountry = $prices->groupBy('country_id')->map(function ($prices) {
            $best = $prices->minBy('price_rub');
            return [
                'country_code' => $best->country->api_code,
                'country_name' => $best->country->name,
                'price_rub' => (float) $best->price_rub,
                'price_usd' => (float) $best->price_rub * 0.011,
                'available_count' => $prices->sum('available_count'),
            ];
        });

        return response()->json([
            'success' => true,
            'product' => [
                'code' => $product->api_code,
                'name' => $product->name,
            ],
            'prices_by_country' => array_values($byCountry->toArray()),
        ]);
    }

    /**
     * Get operators for a specific country/product combination.
     */
    public function getOperators(Request $request)
    {
        $validated = $request->validate([
            'country_code' => 'required|string',
            'product_code' => 'required|string',
        ]);

        $country = \App\Models\FiveSimCountry::where('api_code', $validated['country_code'])->first();
        $product = \App\Models\FiveSimProduct::where('api_code', $validated['product_code'])->first();

        if (!$country || !$product) {
            return response()->json([
                'success' => false,
                'message' => 'Country or product not found',
            ], 404);
        }

        $operators = \App\Models\FiveSimPrice::where('country_id', $country->id)
            ->where('product_id', $product->id)
            ->where('available_count', '>', 0)
            ->with('operator')
            ->get()
            ->map(function ($price) {
                return [
                    'operator_code' => $price->operator->api_code,
                    'operator_name' => $price->operator->name,
                    'price_rub' => (float) $price->price_rub,
                    'price_usd' => (float) $price->price_rub * 0.011,
                    'available_count' => $price->available_count,
                ];
            })
            ->sortBy('price_rub')
            ->values();

        return response()->json([
            'success' => true,
            'country' => [
                'code' => $country->api_code,
                'name' => $country->name,
            ],
            'product' => [
                'code' => $product->api_code,
                'name' => $product->name,
            ],
            'operators' => $operators,
        ]);
    }
}
