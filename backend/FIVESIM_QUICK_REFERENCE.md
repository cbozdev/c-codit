# 5SIM Integration - Quick Reference

## Quick Start

```bash
# 1. Run migration
php artisan migrate

# 2. Populate reference data
php artisan fivesim:sync

# 3. Test it
curl http://localhost:8000/api/v1/fivesim/countries
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    5SIM API (5sim.net)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              SyncFiveSimData (Artisan Command)              │
│         Fetches countries, products, operators, prices      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Database Tables                          │
│  ├── fivesim_countries    (150+ records)                   │
│  ├── fivesim_products     (1000+ records)                  │
│  ├── fivesim_operators    (dynamic per country)            │
│  └── fivesim_prices       (pricing cache)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
    FiveSimService   FiveSimController  Laravel ORM
    (Purchase logic) (API responses)     (Models)
```

## API Response Examples

### Get Countries
```bash
GET /v1/fivesim/countries
```
```json
{
  "success": true,
  "count": 153,
  "data": [
    {
      "id": 1,
      "api_code": "usa",
      "name": "USA",
      "iso_code": "US",
      "phone_prefix": 1
    },
    {
      "id": 2,
      "api_code": "england",
      "name": "England",
      "iso_code": "GB",
      "phone_prefix": 44
    }
  ]
}
```

### Get Products
```bash
GET /v1/fivesim/products
```
```json
{
  "success": true,
  "count": 1202,
  "data": [
    {
      "id": 1,
      "api_code": "telegram",
      "name": "Telegram",
      "description": null
    },
    {
      "id": 2,
      "api_code": "facebook",
      "name": "Facebook",
      "description": null
    }
  ]
}
```

### Get Prices by Product
```bash
GET /v1/fivesim/prices/telegram
```
```json
{
  "success": true,
  "product": {
    "code": "telegram",
    "name": "Telegram"
  },
  "prices_by_country": [
    {
      "country_code": "usa",
      "country_name": "USA",
      "price_rub": 89.0,
      "price_usd": 0.98,
      "available_count": 423
    },
    {
      "country_code": "england",
      "country_name": "England",
      "price_rub": 95.0,
      "price_usd": 1.05,
      "available_count": 189
    }
  ]
}
```

### Get Operators
```bash
POST /v1/fivesim/operators
Content-Type: application/json

{
  "country_code": "usa",
  "product_code": "telegram"
}
```
```json
{
  "success": true,
  "country": {
    "code": "usa",
    "name": "USA"
  },
  "product": {
    "code": "telegram",
    "name": "Telegram"
  },
  "operators": [
    {
      "operator_code": "virtual28",
      "operator_name": "Virtual Operator",
      "price_rub": 89.0,
      "price_usd": 0.98,
      "available_count": 423
    }
  ]
}
```

## Code Examples

### Using FiveSimService

```php
use App\Services\Sms\FiveSimService;

$fivesim = new FiveSimService();

// Get price for a service
$price = $fivesim->getPrice('telegram', 'usa');
// Returns: Money object or null

// Get prices across countries
$prices = $fivesim->getCountryPrices('telegram');
// Returns: Array of [country_code, country_name, count, price_usd]

// Check if available
if ($fivesim->isAvailable('telegram', 'usa')) {
    // Purchase
    $order = $fivesim->purchase('telegram', 'usa');
    // Returns: [provider_order_id, phone_number, expires_at, raw]
}

// Get SMS code
$code = $fivesim->fetchCode($orderId);

// Cancel order
$fivesim->cancel($orderId);

// Finish order
$fivesim->finish($orderId);

// Get user profile
$profile = $fivesim->getUserProfile();

// Get user orders
$orders = $fivesim->getUserOrders(limit: 50, offset: 0);

// Refresh pricing cache
$fivesim->refreshPrices();
```

### Using Eloquent Models

```php
use App\Models\FiveSimCountry;
use App\Models\FiveSimProduct;
use App\Models\FiveSimPrice;

// Get a country
$usa = FiveSimCountry::where('api_code', 'usa')->first();

// Get all products
$products = FiveSimProduct::where('is_active', true)->get();

// Get prices for a specific country/product
$prices = FiveSimPrice::whereHas('country', fn($q) => $q->where('api_code', 'usa'))
    ->whereHas('product', fn($q) => $q->where('api_code', 'telegram'))
    ->where('available_count', '>', 0)
    ->orderBy('price_rub')
    ->get();

// Get best price
$bestPrice = $prices->first()?->price_rub;
```

## Common Tasks

### Task: Display available countries for a product

```php
$product = FiveSimProduct::where('api_code', 'telegram')->first();

$countries = FiveSimPrice::where('product_id', $product->id)
    ->where('available_count', '>', 0)
    ->distinct('country_id')
    ->with('country')
    ->get()
    ->map(fn($price) => $price->country);
```

### Task: Get cheapest country for a product

```php
$product = FiveSimProduct::where('api_code', 'telegram')->first();

$cheapest = FiveSimPrice::where('product_id', $product->id)
    ->where('available_count', '>', 0)
    ->with('country')
    ->orderBy('price_rub')
    ->first();

echo "Cheapest: {$cheapest->country->name} - ${$cheapest->price_rub * 0.011}";
```

### Task: Check if a specific product/country combo is available

```php
$available = FiveSimPrice::whereHas('product', fn($q) => $q->where('api_code', 'telegram'))
    ->whereHas('country', fn($q) => $q->where('api_code', 'usa'))
    ->where('available_count', '>', 0)
    ->exists();

if ($available) {
    echo "Telegram is available in USA";
}
```

## Environment Variables

```env
# Required
FIVESIM_API_KEY=your_api_key_here

# Optional (with defaults)
FIVESIM_BASE_URL=https://5sim.net/v1
PLATFORM_RUB_USD_RATE=0.011
```

## Database Commands

```php
// In tinker

// Count records
FiveSimCountry::count()  // Should be ~150
FiveSimProduct::count()  // Should be ~1200
FiveSimOperator::count() // Variable
FiveSimPrice::count()    // Variable

// Check specific country
FiveSimCountry::where('api_code', 'usa')->first()

// Check specific product
FiveSimProduct::where('api_code', 'telegram')->first()

// Check prices for product
FiveSimPrice::whereHas('product', fn($q) => $q->where('api_code', 'telegram'))
    ->with('country', 'operator')
    ->limit(5)
    ->get()
```

## Debugging

```php
// Enable query logging
\Illuminate\Support\Facades\DB::enableQueryLog();

// Use FiveSimService
$fivesim = new FiveSimService();
$fivesim->purchase('telegram', 'usa');

// See SQL queries
dump(\Illuminate\Support\Facades\DB::getQueryLog());
```

## Performance Tips

1. **Eager load** relationships to avoid N+1 queries:
```php
FiveSimPrice::with('country', 'product', 'operator')->get()
```

2. **Cache API responses**:
```php
Cache::remember('fivesim_countries', 3600, fn() => 
    FiveSimCountry::where('is_active', true)->get()
)
```

3. **Index by code** for faster lookups:
```php
$countries = FiveSimCountry::pluck('id', 'api_code');
// Returns: ['usa' => 1, 'england' => 2, ...]
```

4. **Limit queries** when displaying lists:
```php
FiveSimProduct::paginate(50)
```

## Useful Artisan Commands

```bash
# Seed all data
php artisan fivesim:sync

# Sync only prices (fastest)
php artisan fivesim:sync --prices

# Sync everything except prices
php artisan fivesim:sync --countries --products --operators

# Clear all 5sim data (⚠️ careful!)
php artisan tinker
>>> FiveSimCountry::truncate(); FiveSimProduct::truncate(); FiveSimOperator::truncate(); FiveSimPrice::truncate();
```

## Status Checks

```bash
# Are tables created?
php artisan tinker
>>> FiveSimCountry::count()

# Is sync working?
php artisan fivesim:sync

# Can we purchase?
curl -X POST http://localhost:8000/api/v1/services/virtual-number/purchase \
  -H "Authorization: Bearer TOKEN" \
  -d '{"service":"telegram","country":"usa"}'
```

## Files Reference

| File | Purpose |
|------|---------|
| `FiveSimService.php` | Core service logic for purchases, fetching codes, etc. |
| `FiveSimController.php` | API endpoints for countries, products, pricing, operators |
| `FiveSimCountry.php` | Eloquent model for countries |
| `FiveSimProduct.php` | Eloquent model for products |
| `FiveSimOperator.php` | Eloquent model for operators |
| `FiveSimPrice.php` | Eloquent model for pricing cache |
| `SyncFiveSimData.php` | Artisan command to populate DB from API |
| `2026_06_13_000001_create_fivesim_reference_tables.php` | Database migration |
| `FIVESIM_INTEGRATION.md` | Full documentation |
| `FIVESIM_REBUILD_SUMMARY.md` | Implementation details |

## Support

- **Setup issues**: See `FIVESIM_INTEGRATION.md`
- **API questions**: Check https://5sim.net/docs
- **DB schema**: Read the migration file
- **Examples**: Check `FIVESIM_QUICK_REFERENCE.md` (this file)
