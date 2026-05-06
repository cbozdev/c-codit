# RI Hair Collectables — Luxury Hair eCommerce Platform

> Premium human hair eCommerce built with Next.js 15, TypeScript, PostgreSQL, and dual payment gateways (Paystack + Stripe).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, RSC) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4 + CVA |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | NextAuth v5 (Google + Credentials) |
| State | Zustand + Immer |
| Payments | Paystack (West Africa) + Stripe (International) |
| Media | Cloudinary |
| Email | Resend |
| CMS | Sanity |
| Cache | Redis (Upstash / Render Redis) |
| Monitoring | Sentry |
| Analytics | GA4 + Meta Pixel |
| Deployment | Render |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16
- Redis 7

### 1. Clone and install

```bash
git clone https://github.com/cbozdev/c-codit.git
cd c-codit/rihair
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` (see [Environment Variables](#environment-variables)).

### 3. Set up the database

```bash
pnpm prisma migrate dev --name init
pnpm prisma generate
pnpm prisma db seed
```

### 4. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create `.env.local` in the `rihair/` directory:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rihair

# Redis
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-run-openssl-rand-base64-32

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Paystack (West Africa)
PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_WEBHOOK_SECRET=

# Stripe (International)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=

# Resend (email)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=orders@rihaircollectables.com

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=

# WhatsApp
NEXT_PUBLIC_WHATSAPP_NUMBER=+2348000000000
```

---

## Project Structure

```
rihair/
├── prisma/
│   ├── schema.prisma          # Full database schema (30+ models)
│   └── seed.ts                # Production seed data
├── public/
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # App icons
├── src/
│   ├── app/
│   │   ├── (shop)/            # Public storefront routes
│   │   │   ├── page.tsx       # Homepage
│   │   │   ├── shop/          # Product catalogue
│   │   │   ├── products/[slug]/ # Product detail
│   │   │   ├── checkout/      # Multi-step checkout
│   │   │   ├── booking/       # Appointment booking
│   │   │   ├── about/
│   │   │   ├── blog/
│   │   │   ├── contact/
│   │   │   └── faq/
│   │   ├── (auth)/            # Authentication routes
│   │   │   └── auth/
│   │   │       ├── login/
│   │   │       ├── register/
│   │   │       ├── forgot-password/
│   │   │       └── reset-password/
│   │   ├── (customer)/        # Authenticated customer area
│   │   │   └── dashboard/     # Orders, wishlist, addresses, loyalty
│   │   ├── (admin)/           # Admin panel (ADMIN/SUPER_ADMIN)
│   │   │   └── admin/         # Products, orders, customers, analytics
│   │   └── api/               # API routes
│   │       ├── auth/          # NextAuth handlers
│   │       ├── payments/      # Paystack + Stripe
│   │       ├── webhooks/      # Payment webhooks
│   │       ├── geo/           # Geolocation for payment routing
│   │       └── health/        # Health check
│   ├── components/
│   │   ├── ui/                # Design system components
│   │   └── layout/            # Header, Footer, etc.
│   ├── domains/
│   │   ├── products/          # Product service + types
│   │   └── orders/            # Order service + types
│   ├── lib/
│   │   ├── auth/              # NextAuth config
│   │   ├── db/                # Prisma client singleton
│   │   ├── payments/          # Paystack + Stripe helpers
│   │   ├── cache/             # Redis helpers
│   │   ├── email/             # Resend templates
│   │   └── utils/             # Currency, formatting, etc.
│   ├── stores/                # Zustand stores (cart, currency, wishlist)
│   └── middleware.ts          # Auth + rate-limiting middleware
├── render.yaml                # Render deployment config
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Key Features

### Storefront
- **Homepage** — Hero with parallax, featured products carousel, testimonials, booking CTA
- **Shop** — Filter by category, origin, texture, lace type, length, price; sort; pagination
- **Product Detail** — Image gallery, variant selectors (length/density/color), live stock, WhatsApp enquiry
- **Cart** — Drawer with live totals, currency conversion, promo code
- **Checkout** — 3-step (Information → Shipping → Payment) with address autocomplete
- **Booking** — Calendar slot picker for wig installation, consultation, custom creation

### Payments
- **West Africa** (Nigeria, Ghana): Paystack inline (NGN/GHS)
- **International** (UK, USA, Canada): Stripe Elements (USD/GBP/CAD)
- **Auto-detection** via Cloudflare `cf-ipcountry` / Vercel `x-vercel-ip-country` headers
- **Webhooks** with HMAC signature verification for both providers

### Customer Dashboard
- Order history with tracking timeline
- Wishlist management
- Saved addresses
- Loyalty points balance + tier (Bronze/Silver/Gold/Platinum)
- Referral code

### Admin Panel
- Revenue dashboard (30d stats)
- Product CRUD with Cloudinary image uploads
- Order management + status updates
- Customer list with order history
- Inventory low-stock alerts
- Booking calendar management
- Coupon / promo code management
- Analytics overview

### Multi-Currency
- NGN, GHS, USD, GBP, CAD
- Live exchange rates cached in Redis (1h TTL)
- Currency selector persisted to localStorage

---

## Database

The Prisma schema covers:

- `User` + `Account` + `Session` (NextAuth)
- `Product` + `ProductVariant` + `ProductImage`
- `Category`
- `Order` + `OrderItem` + `OrderTimeline`
- `Payment` + `Refund`
- `Cart` + `CartItem`
- `Wishlist` + `WishlistItem`
- `Address`
- `BookingSlot` + `Booking`
- `Coupon` + `CouponUsage`
- `LoyaltyAccount` + `LoyaltyTransaction`
- `Referral`
- `ShippingZone` + `ShippingRate`
- `Shipment`
- `BlogPost`
- `Testimonial`
- `Review`
- `FraudLog`
- `AuditLog`

### Migrations

```bash
# Create a migration
pnpm prisma migrate dev --name <name>

# Apply migrations in production
pnpm prisma migrate deploy

# Reset database (dev only)
pnpm prisma migrate reset
```

---

## Development Commands

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # ESLint
pnpm test         # Vitest
pnpm test:watch   # Vitest watch mode
pnpm prisma studio  # Open Prisma Studio (database GUI)
```

---

## Deployment

### Render (Recommended)

1. Connect your GitHub repository to Render
2. Render reads `render.yaml` automatically and provisions:
   - Web service (Next.js)
   - PostgreSQL 16 database
   - Redis instance
3. Set all required environment variables in the Render dashboard
4. Push to `main` to trigger automatic deploys

### Manual Deploy

```bash
pnpm prisma migrate deploy
pnpm build
pnpm start
```

### Health Check

`GET /api/health` — returns `{ status: "ok", timestamp: "..." }`

---

## Admin Access

Default super admin (seeded):

| Field | Value |
|-------|-------|
| Email | `admin@rihaircollectables.com` |
| Password | `Admin@RIHair2024!` |

**Change this password immediately in production.**

---

## Payment Webhooks

### Stripe
- Endpoint: `POST /api/webhooks/stripe`
- Verify with: `STRIPE_WEBHOOK_SECRET`
- Events handled: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.dispute.created`

### Paystack
- Endpoint: `POST /api/webhooks/paystack`
- Verify with: `PAYSTACK_WEBHOOK_SECRET` (HMAC-SHA512)
- Events handled: `charge.success`, `charge.failed`

---

## Brand Identity

- **Primary Black**: `#0A0A0A`
- **Gold**: `#C9A84C`
- **Warm White**: `#FAFAF8`
- **Display font**: Cormorant Garamond
- **Body font**: DM Sans

---

## License

Proprietary — RI Hair Collectables. All rights reserved.
