# 5SIM Integration - Complete Rebuild

## Overview

The 5SIM integration has been completely rebuilt from scratch to follow the exact API specification from https://5sim.net/docs. The new implementation:

1. **Uses a database** to store reference data (countries, products, operators, pricing)
2. **Dynamically selects operators** based on current availability and pricing
3. **Implements all 5SIM API endpoints** from the official documentation
4. **Caches pricing data** for better performance
5. **Provides public APIs** for frontend to query available countries, products, and pricing

## What Changed

### Files Created

#### Database
- `database/migrations/2026_06_13_000001_create_fivesim_reference_tables.php`
  - Creates 5 new tables: `fivesim_countries`, `fivesim_products`, `fivesim_operators`, `fivesim_prices`

#### Models
- `app/Models/FiveSimCountry.php` - Eloquent model for countries
- `app/Models/FiveSimProduct.php` - Eloquent model for products
- `app/Models/FiveSimOperator.php` - Eloquent model for operators
- `app/Models/FiveSimPrice.php` - Eloquent model for pricing cache

#### Service Class
- `app/Services/Sms/FiveSimService.php` - Completely rewritten to use database
  - Implements all endpoints from 5SIM API documentation
  - Automatic operator selection based on pricing
  - Methods: `purchase()`, `fetchCode()`, `cancel()`, `finish()`, `ban()`, `getPrice()`, `getCountryPrices()`, `getUserProfile()`, `getUserOrders()`, `refreshPrices()`

#### Artisan Command
- `app/Console/Commands/SyncFiveSimData.php`
  - Syncs all reference data from 5SIM API
  - Usage: `php artisan fivesim:sync`
  - Can sync specific data types: `--countries`, `--products`, `--operators`, `--prices`

#### API Endpoints
- `app/Http/Controllers/Api/V1/FiveSimController.php`
- Routes in `routes/api.php`:

**Public (Authenticated Users)**
- `GET /v1/fivesim/countries` - List all supported countries
- `GET /v1/fivesim/products` - List all supported products/services
- `GET /v1/fivesim/prices/{productCode}` - Get pricing by product across countries
- `POST /v1/fivesim/operators` - Get operators for country/product combination

**Admin Only**
- `POST /v1/fivesim/sync` - Trigger reference data sync from 5SIM API

## Setup Instructions

### Step 1: Run Migration

```bash
php artisan migrate
```

This creates the 5 new tables needed to store reference data.

### Step 2: Seed Initial Data

Option A: Via HTTP (Production Recommended)
```bash
curl -X POST https://your-domain/api/v1/admin/fivesim/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "countries": true,
    "products": true,
    "operators": true,
    "prices": true
  }'
```

Option B: Via Artisan CLI (Development)
```bash
php artisan fivesim:sync
```

Or sync specific data types:
```bash
php artisan fivesim:sync --countries
php artisan fivesim:sync --products
php artisan fivesim:sync --operators
php artisan fivesim:sync --prices
```

## 5SIM API Endpoints Implemented

### Authentication
- All endpoints use: `Authorization: Bearer $FIVESIM_API_KEY`

### User Operations
- **GET** `/v1/user/profile` - Get user balance and profile (via `getUserProfile()`)
- **GET** `/v1/user/orders` - Get order history (via `getUserOrders()`)

### Number Purchase
- **GET** `/v1/user/buy/activation/{country}/{operator}/{product}` - Purchase number (via `purchase()`)

### Order Management
- **GET** `/v1/user/check/{id}` - Check status and get SMS (via `fetchCode()`)
- **GET** `/v1/user/finish/{id}` - Mark order as finished (via `finish()`)
- **GET** `/v1/user/cancel/{id}` - Cancel order (via `cancel()`)
- **GET** `/v1/user/ban/{id}` - Ban/block order (via `ban()`)

### Public Data
- **GET** `/v1/guest/prices` - Get all pricing (cached in DB, via `refreshPrices()`)
- **GET** `/v1/guest/countries` - Get countries list
- **GET** `/v1/guest/products` - Get products list
- **GET** `/v1/guest/products/{country}/{product}` - Get operators for country/product

## Database Schema

### fivesim_countries
```
- id (PK)
- api_code (unique) - e.g., 'usa', 'england', 'india'
- name - Display name
- iso_code - Optional ISO-2 code
- phone_prefix - Optional phone prefix
- is_active - Enable/disable country
- metadata - JSON field for future data
- timestamps
```

### fivesim_products
```
- id (PK)
- api_code (unique) - e.g., 'telegram', 'facebook', 'amazon'
- name - Display name
- description - Optional description
- service_id - 5SIM internal ID if available
- is_active - Enable/disable product
- metadata - JSON field
- timestamps
```

### fivesim_operators
```
- id (PK)
- country_id (FK) - Reference to fivesim_countries
- api_code - e.g., 'virtual28', 'mts', 'verizon'
- name - Display name
- product_count - Number of products available
- is_active - Enable/disable operator
- metadata - JSON field
- timestamps
- Unique: (country_id, api_code)
```

### fivesim_prices
```
- id (PK)
- country_id (FK)
- product_id (FK)
- operator_id (FK)
- price_rub - Price in Russian Rubles (5SIM native currency)
- available_count - Number of numbers in stock
- last_fetched_at - When price was last updated
- timestamps
- Unique: (country_id, product_id, operator_id)
```

## Frontend Integration

The frontend can now query available countries and products dynamically:

```typescript
// Get all countries
const countries = await fetch('/api/v1/fivesim/countries').then(r => r.json());

// Get all products
const products = await fetch('/api/v1/fivesim/products').then(r => r.json());

// Get pricing for a specific product
const prices = await fetch('/api/v1/fivesim/prices/telegram').then(r => r.json());

// Get operators for a country/product combination
const operators = await fetch('/api/v1/fivesim/operators', {
  method: 'POST',
  body: JSON.stringify({
    country_code: 'usa',
    product_code: 'telegram'
  })
}).then(r => r.json());
```

## Key Improvements

1. **No Hardcoded Mappings** - Countries and products are fetched from the actual API
2. **Dynamic Operator Selection** - Automatically picks the cheapest available operator
3. **Accurate Pricing** - Pricing is cached and can be refreshed on demand
4. **API Compliance** - Follows exact 5SIM API specification
5. **Scalable** - Supports all 150+ countries and 1000+ products without code changes
6. **Better Error Handling** - Specific error messages for unavailable services

## Configuration

Set these environment variables in `.env`:

```
FIVESIM_API_KEY=your_api_key_here
FIVESIM_BASE_URL=https://5sim.net/v1

# Optional: RUB to USD exchange rate (defaults to 0.011)
PLATFORM_RUB_USD_RATE=0.011
```

## Currency Conversion

Prices from 5SIM are in Russian Rubles (RUB). The service automatically converts to USD using the configured exchange rate:

```php
$usd_price = $rub_price * config('services.platform.rub_usd_rate', 0.011);
```

## Maintenance

### Refresh Pricing Cache

Run periodically (e.g., via scheduler):

```php
// In app/Console/Kernel.php
$schedule->call(function () {
    app(FiveSimService::class)->refreshPrices();
})->hourly();
```

Or via HTTP (admin only):
```bash
curl -X POST https://your-domain/api/v1/admin/fivesim/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"prices": true}'
```

## Testing

To test the integration:

1. Seed the database: `php artisan fivesim:sync`
2. Query available countries: `GET /api/v1/fivesim/countries`
3. Check a product's availability: `GET /api/v1/fivesim/prices/telegram`
4. Verify operator selection: `POST /api/v1/fivesim/operators` with country/product
5. Purchase a number via the normal purchase flow

## Troubleshooting

**"Product not found" error**
- Ensure `fivesim:sync --products` has been run
- Check that the product code matches exactly (case-insensitive)

**"No numbers available" error**
- The product is not in stock in that country
- Try a different country using `GET /api/v1/fivesim/prices/{productCode}`

**"Authentication failed" error**
- Verify `FIVESIM_API_KEY` in `.env` is correct
- The API key may have expired; generate a new one from 5sim.net dashboard

**Prices showing as zero**
- Run `php artisan fivesim:sync --prices` to refresh from API
- Check that operators exist for the country/product combination

## References

- 5SIM API Documentation: https://5sim.net/docs
- Countries: https://5sim.net/settings/countries
- Products: https://5sim.net/settings/products
- Operators: https://5sim.net/settings/operators
