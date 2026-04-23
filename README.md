# C-codit

A production-grade digital services platform: buy virtual numbers, eSIM, gift cards, pay utility bills — all powered by a single wallet that you fund by card (Flutterwave) or crypto (NowPayments).

---

## Architecture

```
c-codit/
├── backend/          Laravel 11 API (PHP 8.3, PostgreSQL, Redis)
├── frontend/         React 18 + Vite + TypeScript + Tailwind CSS
└── docker-compose.yml
```

Backend and frontend are fully separated, communicating only through the REST API at `/api/v1`.

---

## Financial design

Every cent that moves through the platform is recorded in a **double-entry ledger** (`ledger_entries`). The `wallets.balance_minor` column is a denormalised cache — the ledger is the source of truth.

| Principle | Implementation |
|---|---|
| Double-entry | Every journal must have matching debits = credits (app + DB trigger) |
| Immutability | `ledger_entries` rows cannot be updated or deleted (app guard + DB trigger) |
| Idempotency | Per-leg `idempotency_key` unique index; idempotency middleware on all write endpoints |
| Race-condition safety | `SELECT … FOR UPDATE` on wallet + ledger accounts before posting |
| Refund on failure | `ServicePurchaseService` auto-calls `refundSuspense()` if the provider call throws |
| Webhook dedup | `webhook_events.signature_hash` unique index prevents double-credit |
| Auth re-verification | Flutterwave/NowPayments webhooks are *signature-verified* then *re-fetched from the provider API* before crediting |

---

## Quick start (Docker Compose)

```bash
git clone <repo> c-codit && cd c-codit

# Copy and review environment variables
cp backend/.env.example backend/.env

# Start everything
docker compose up --build
```

Services:
- **API**: http://localhost:8080
- **Frontend**: http://localhost:5173
- **Postgres**: localhost:5432
- **Redis**: localhost:6379

On first boot the entrypoint automatically runs `migrate` and `db:seed`.

Default admin account: `admin@c-codit.com` / `ChangeMe!2025`
(Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env` to change these before seeding.)

---

## Local development (without Docker)

### Backend

```bash
cd backend
composer install

# Copy and configure
cp .env.example .env
# Edit .env: set DB_*, REDIS_*, mail, and provider credentials

php artisan key:generate
php artisan migrate
php artisan db:seed

php artisan serve           # http://localhost:8000
php artisan queue:work      # separate terminal
```

### Frontend

```bash
cd frontend
npm install

# Set the API URL
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local

npm run dev                 # http://localhost:5173
```

---

## Environment variables

Copy `backend/.env.example`. Key variables:

| Variable | Description |
|---|---|
| `APP_KEY` | Generate with `php artisan key:generate --show` |
| `DATABASE_URL` | Full Postgres URL (used on Render). Overrides `DB_*` vars. |
| `REDIS_URL` | Full Redis URL (used on Render). Overrides `REDIS_*` vars. |
| `FLUTTERWAVE_SECRET_KEY` | From your Flutterwave dashboard |
| `FLUTTERWAVE_WEBHOOK_SECRET` | Secret set in Flutterwave webhook settings |
| `NOWPAYMENTS_API_KEY` | From NowPayments dashboard |
| `NOWPAYMENTS_IPN_SECRET` | From NowPayments IPN settings |
| `FIVESIM_API_KEY` | 5sim API key |
| `SMSACTIVATE_API_KEY` | sms-activate API key |
| `FRONTEND_URL` | Used for CORS, email links, payment redirects |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins allowed (e.g. `https://app.c-codit.com`) |

---

## Deploying to Render

### Backend (Web Service)

1. Create a new **Web Service** on Render.
2. Connect your repository; set **Root directory** to `backend`.
3. Set **Environment** to `Docker`.
4. Add a **PostgreSQL** add-on — Render injects `DATABASE_URL` automatically.
5. Add a **Redis** add-on — Render injects `REDIS_URL` automatically.
6. Set all environment variables from `.env.example`.
7. Set `APP_ENV=production`, `APP_DEBUG=false`.
8. Set `RUN_MIGRATIONS=true` (default — safe to leave on).
9. Set `RUN_SEEDERS=true` **only on the first deploy**, then unset it.
10. Render auto-injects `PORT`; the entrypoint binds nginx to it.

### Frontend (Static Site)

1. Create a new **Static Site** on Render.
2. Connect your repository; set **Root directory** to `frontend`.
3. **Build command**: `npm install && npm run build`
4. **Publish directory**: `dist`
5. Add environment variable: `VITE_API_URL=https://your-api.onrender.com/api/v1`
6. Configure the rewrite rule: `/* → /index.html` (200 status) for SPA routing.

### Webhook URLs

Register these in each provider's dashboard:

| Provider | Webhook URL |
|---|---|
| Flutterwave | `https://your-api.onrender.com/api/v1/webhooks/flutterwave` |
| NowPayments | `https://your-api.onrender.com/api/v1/webhooks/nowpayments` |

---

## API reference

All responses follow:
```json
{ "success": true, "message": "...", "data": {} }
```

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register (returns token) |
| POST | `/api/v1/auth/login` | Login (returns token) |
| POST | `/api/v1/auth/logout` | Revoke current token |
| POST | `/api/v1/auth/logout-all` | Revoke all tokens |
| GET  | `/api/v1/auth/me` | Authenticated user |
| POST | `/api/v1/auth/forgot-password` | Send reset link |
| POST | `/api/v1/auth/reset-password` | Reset password |

### Wallet

| Method | Path | Description |
|---|---|---|
| GET  | `/api/v1/wallet` | Get wallet balance |
| POST | `/api/v1/wallet/fund` | Initiate funding (requires `Idempotency-Key` header) |
| GET  | `/api/v1/wallet/transactions` | List transactions (paginated) |
| GET  | `/api/v1/wallet/transactions/:id` | Get single transaction |

### Services

| Method | Path | Description |
|---|---|---|
| GET  | `/api/v1/services` | List all active services |
| GET  | `/api/v1/services/:code` | Get service detail |
| POST | `/api/v1/services/virtual-number/purchase` | Buy virtual number (requires `Idempotency-Key`) |
| GET  | `/api/v1/orders` | List orders (paginated) |
| GET  | `/api/v1/orders/:id` | Get order detail |

### Webhooks (public)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/webhooks/flutterwave` | Flutterwave payment webhooks |
| POST | `/api/v1/webhooks/nowpayments` | NowPayments IPN callbacks |

### Admin (role: admin)

| Method | Path | Description |
|---|---|---|
| GET  | `/api/v1/admin/users` | List users |
| POST | `/api/v1/admin/users/:id/suspend` | Suspend user |
| POST | `/api/v1/admin/users/:id/unsuspend` | Unsuspend user |
| GET  | `/api/v1/admin/transactions` | List all transactions |
| GET  | `/api/v1/admin/metrics` | Platform metrics |
| POST | `/api/v1/admin/services/:code/toggle` | Enable/disable service |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | DB + Redis + app status |

---

## Rate limits

| Endpoint group | Limit |
|---|---|
| Auth (register, login) | 10 req/min per IP |
| Payments (wallet fund) | 20 req/min per user |
| Service purchases | 30 req/min per user |
| General API | 120 req/min per user |
| Webhooks | 600 req/min per IP |

---

## Running tests

```bash
cd backend

# Create a test database
createdb ccodit_test

php artisan test
# or: ./vendor/bin/phpunit
```

Tests cover:
- `MoneyTest` — integer arithmetic, currency mismatch, markup rounding
- `LedgerTest` — balanced journal, hold/settle/refund flow, insufficient funds, idempotency
- `AuthTest` — register, bad credentials, authenticated profile

---

## Adding a new service provider

1. Create `app/Services/Sms/YourProvider.php` implementing `SmsNumberProvider`.
2. Register as singleton in `AppServiceProvider`.
3. Add a branch in `ServicePurchaseService::providerFor()`.
4. Seed a row in the `services` table.
5. Set your API key in `.env` and `config/services.php`.

No changes to the ledger, wallet, or payment layers required.

---

## Adding a new payment provider

1. Create `app/Services/Payment/YourProvider.php` implementing `PaymentGateway`.
2. Add an enum case to `PaymentProvider`.
3. Register in `AppServiceProvider` and wire into `PaymentOrchestrator::for()`.
4. Add a webhook route and a `->yourprovider()` method to `WebhookController`.
5. Add a chart-of-accounts entry for `cash.<yourprovider>` in `ChartOfAccounts`.

---

## Project structure

```
backend/app/
├── Enums/               TransactionType, TransactionStatus, PaymentProvider, ...
├── Http/
│   ├── Controllers/Api/V1/   AuthController, WalletController, ServiceController,
│   │                         WebhookController, AdminController, HealthController
│   ├── Middleware/       ForceJsonResponse, IdempotencyMiddleware, SecurityHeaders,
│   │                     EnsureUserIsActive
│   ├── Requests/         RegisterRequest, LoginRequest, FundWalletRequest,
│   │                     PurchaseVirtualNumberRequest
│   └── Resources/        UserResource, WalletResource, TransactionResource,
│                         ServiceResource, ServiceOrderResource
├── Models/               User, Wallet, LedgerAccount, LedgerEntry, Transaction,
│                         Payment, Service, ServiceOrder, FeatureFlag, AuditLog,
│                         WebhookEvent
├── Services/
│   ├── Ledger/           LedgerService, ChartOfAccounts, JournalLeg,
│   │                     InsufficientFundsException
│   ├── Wallet/           WalletService
│   ├── Payment/          FlutterwaveService, NowPaymentsService,
│   │                     PaymentOrchestrator, Contracts/PaymentGateway
│   ├── Sms/              FiveSimService, SmsActivateService,
│   │                     Contracts/SmsNumberProvider
│   ├── Support/          ExternalHttp
│   └── ServicePurchaseService
└── Support/              Money, ApiResponse, Audit
```

---

## License

MIT
