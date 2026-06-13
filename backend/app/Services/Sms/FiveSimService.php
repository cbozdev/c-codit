<?php

namespace App\Services\Sms;

use App\Models\FiveSimCountry;
use App\Models\FiveSimOperator;
use App\Models\FiveSimPrice;
use App\Models\FiveSimProduct;
use App\Services\Sms\Contracts\SmsNumberProvider;
use App\Support\Money;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class FiveSimService implements SmsNumberProvider
{
    public function code(): string { return '5sim'; }

    private string $baseUrl = 'https://5sim.net/v1';
    private float $rubUsdRate;

    public function __construct()
    {
        $this->rubUsdRate = (float) config('services.platform.rub_usd_rate', 0.011);
    }

    private function client()
    {
        return Http::baseUrl($this->baseUrl)
            ->withHeaders([
                'Authorization' => 'Bearer ' . config('services.fivesim.api_key'),
                'Accept' => 'application/json',
            ])
            ->timeout(30);
    }

    /**
     * Normalize service name to 5sim product code.
     * Maps common aliases to official API codes from database.
     */
    private function normalizeProduct(string $service): ?FiveSimProduct
    {
        $code = strtolower(trim($service));
        return FiveSimProduct::where('api_code', $code)
            ->orWhere('name', 'ilike', $code)
            ->first();
    }

    /**
     * Normalize country name to 5sim country record.
     * Supports both API codes and display names.
     */
    private function normalizeCountry(string $country): ?FiveSimCountry
    {
        $code = strtolower(trim($country));
        return FiveSimCountry::where('api_code', $code)
            ->orWhere('name', 'ilike', $code)
            ->first();
    }

    public function getPrice(string $service, string $country): ?Money
    {
        $product = $this->normalizeProduct($service);
        $countryObj = $this->normalizeCountry($country);

        if (!$product) {
            Log::warning('5sim.getPrice.unsupported_product', ['service' => $service]);
            return null;
        }

        if (!$countryObj) {
            Log::warning('5sim.getPrice.unsupported_country', ['country' => $country]);
            return null;
        }

        try {
            // Get the cheapest operator for this product/country combo
            $price = FiveSimPrice::where('product_id', $product->id)
                ->where('country_id', $countryObj->id)
                ->where('available_count', '>', 0)
                ->orderBy('price_rub')
                ->first();

            if (!$price || $price->price_rub <= 0) {
                return null;
            }

            // Convert RUB to USD
            $usd = $price->price_rub * $this->rubUsdRate;
            return Money::fromDecimal(sprintf('%.4f', max($usd, 0.01)), 'USD');
        } catch (\Throwable $e) {
            Log::warning('5sim.getPrice.exception', [
                'error' => $e->getMessage(),
                'product' => $service,
                'country' => $country,
            ]);
            return null;
        }
    }

    /**
     * Returns prices for all countries where a product is available, sorted cheapest first.
     */
    public function getCountryPrices(string $service): array
    {
        $product = $this->normalizeProduct($service);
        if (!$product) return [];

        try {
            $prices = FiveSimPrice::where('product_id', $product->id)
                ->where('available_count', '>', 0)
                ->with('country')
                ->get()
                ->groupBy('country_id');

            $results = [];

            foreach ($prices as $countryId => $countryPrices) {
                $bestPrice = $countryPrices->min('price_rub');
                $totalCount = $countryPrices->sum('available_count');

                if ($bestPrice && $bestPrice > 0) {
                    $results[] = [
                        'country_code' => $countryPrices[0]->country->api_code,
                        'country_name'  => $countryPrices[0]->country->name,
                        'count'         => $totalCount,
                        'price_usd'     => $bestPrice * $this->rubUsdRate,
                    ];
                }
            }

            usort($results, fn($a, $b) => $a['price_usd'] <=> $b['price_usd']);
            return $results;
        } catch (\Throwable) {
            return [];
        }
    }

    public function isAvailable(string $service, string $country): bool
    {
        return $this->getPrice($service, $country) !== null;
    }

    /**
     * Purchase an activation number for a service in a specific country.
     * Automatically selects the cheapest available operator.
     */
    public function purchase(string $service, string $country, ?string $areaCode = null): array
    {
        $product = $this->normalizeProduct($service);
        $countryObj = $this->normalizeCountry($country);

        if (!$product) {
            throw new ServiceUnavailableException('Service not found: ' . $service);
        }

        if (!$countryObj) {
            throw new ServiceUnavailableException('Country not found: ' . $country);
        }

        // Get the cheapest available operator for this product/country
        $price = FiveSimPrice::where('product_id', $product->id)
            ->where('country_id', $countryObj->id)
            ->where('available_count', '>', 0)
            ->with('operator')
            ->orderBy('price_rub')
            ->first();

        if (!$price) {
            throw new ServiceUnavailableException(
                'No numbers available for ' . $product->name . ' in ' . $countryObj->name
            );
        }

        $operator = $price->operator;
        $endpoint = "/user/buy/activation/{$countryObj->api_code}/{$operator->api_code}/{$product->api_code}";

        Log::info('5sim.purchase.attempt', [
            'product' => $product->api_code,
            'country' => $countryObj->api_code,
            'operator' => $operator->api_code,
            'endpoint' => $endpoint,
        ]);

        try {
            $res = $this->client()->get($endpoint);

            Log::info('5sim.purchase.response', [
                'status' => $res->status(),
                'body' => substr($res->body(), 0, 500),
                'product' => $product->api_code,
                'country' => $countryObj->api_code,
                'operator' => $operator->api_code,
            ]);

            if ($res->status() === 400) {
                throw new ServiceUnavailableException(
                    'No numbers available for this service. Please try again or select a different country.'
                );
            }

            if ($res->status() === 401) {
                Log::error('5sim.purchase.auth_failed');
                throw new RuntimeException('5sim authentication failed — check FIVESIM_API_KEY');
            }

            if (!$res->successful()) {
                throw new RuntimeException(
                    '5sim API error: HTTP ' . $res->status() . ' — ' . substr($res->body(), 0, 200)
                );
            }

            $body = $res->json();

            if (empty($body['id']) || empty($body['phone'])) {
                Log::error('5sim.purchase.bad_response', ['body' => $body]);
                throw new RuntimeException('5sim returned unexpected response: ' . json_encode($body));
            }

            return [
                'provider_order_id' => (string) $body['id'],
                'phone_number' => '+' . ltrim((string) $body['phone'], '+'),
                'expires_at' => $body['expires'] ?? null,
                'status' => $body['status'] ?? null,
                'created_at' => $body['created_at'] ?? null,
                'raw' => $body,
            ];
        } catch (ServiceUnavailableException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('5sim.purchase.exception', [
                'error' => $e->getMessage(),
                'product' => $product->api_code,
                'country' => $countryObj->api_code,
            ]);
            throw $e instanceof RuntimeException ? $e : new RuntimeException($e->getMessage());
        }
    }

    /**
     * Get the current status of an order and any received SMS codes.
     * Implements GET /v1/user/check/{id}
     */
    public function fetchCode(string $providerOrderId): ?string
    {
        try {
            $res = $this->client()->get("/user/check/{$providerOrderId}");

            if (!$res->successful()) {
                Log::warning('5sim.fetchCode.failed', [
                    'status' => $res->status(),
                    'order_id' => $providerOrderId,
                ]);
                return null;
            }

            $body = (array) $res->json();

            // Check for SMS codes in the response
            foreach (($body['sms'] ?? []) as $sms) {
                if (!empty($sms['code'])) {
                    return (string) $sms['code'];
                }
                // Fallback: try to extract code from text
                if (!empty($sms['text'])) {
                    if (preg_match('/\b(\d{4,8})\b/', (string) $sms['text'], $m)) {
                        return $m[1];
                    }
                }
            }

            return null;
        } catch (\Throwable $e) {
            Log::warning('5sim.fetchCode.exception', [
                'error' => $e->getMessage(),
                'order_id' => $providerOrderId,
            ]);
            return null;
        }
    }

    /**
     * Mark an order as finished.
     * Implements GET /v1/user/finish/{id}
     */
    public function finish(string $providerOrderId): bool
    {
        try {
            $res = $this->client()->get("/user/finish/{$providerOrderId}");
            return $res->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Cancel an order and refund the payment.
     * Implements GET /v1/user/cancel/{id}
     */
    public function cancel(string $providerOrderId): bool
    {
        try {
            $res = $this->client()->get("/user/cancel/{$providerOrderId}");
            if ($res->successful()) {
                Log::info('5sim.cancel.success', ['order_id' => $providerOrderId]);
                return true;
            }
            Log::warning('5sim.cancel.failed', [
                'status' => $res->status(),
                'order_id' => $providerOrderId,
            ]);
            return false;
        } catch (\Throwable $e) {
            Log::error('5sim.cancel.exception', [
                'error' => $e->getMessage(),
                'order_id' => $providerOrderId,
            ]);
            return false;
        }
    }

    /**
     * Ban/block an order to prevent further SMS from being received.
     * Implements GET /v1/user/ban/{id}
     */
    public function ban(string $providerOrderId): bool
    {
        try {
            $res = $this->client()->get("/user/ban/{$providerOrderId}");
            return $res->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Retrieve user profile information.
     * Implements GET /v1/user/profile
     */
    public function getUserProfile(): ?array
    {
        try {
            $res = $this->client()->get('/user/profile');
            if (!$res->successful()) return null;
            return $res->json();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Get user's order history.
     * Implements GET /v1/user/orders
     */
    public function getUserOrders(int $limit = 50, int $offset = 0): ?array
    {
        try {
            $res = $this->client()->get('/user/orders', [
                'limit' => $limit,
                'offset' => $offset,
            ]);
            if (!$res->successful()) return null;
            return $res->json();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Refresh pricing data from the API.
     * This should be called periodically to keep prices up-to-date.
     */
    public function refreshPrices(): bool
    {
        try {
            $res = $this->client()->get('/guest/prices');

            if (!$res->successful()) {
                Log::warning('5sim.refreshPrices.failed', ['status' => $res->status()]);
                return false;
            }

            $body = $res->json();
            $upserted = 0;

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
                            FiveSimPrice::updateOrCreate(
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

            Log::info('5sim.refreshPrices.success', ['entries' => $upserted]);
            return true;
        } catch (\Throwable $e) {
            Log::error('5sim.refreshPrices.exception', ['error' => $e->getMessage()]);
            return false;
        }
    }
}
