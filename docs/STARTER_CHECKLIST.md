# Starter Checklist (Productized Niche Template)

Use this repo as a reusable starter by changing **only config + env vars**, then seeding a niche dataset.

## 1) Brand

- Edit `packages/config/brand.ts`
  - `storeName`, `tagline`
  - `colors` (primary, background, borders, etc.)
  - `logo.src` / `logo.alt`
- Add your logo asset(s)
  - Store: `apps/store/public/logo.svg` (or adjust `logo.src`)
  - Admin: add `apps/admin/public/` if you want to serve a logo there too

## 2) Catalog Categories

- Edit `packages/config/categories.ts`
  - Update `catalogCategories` labels/order
  - Update `catalogCategoryIds` to match the categories you want visible/selectable
- If you add/remove category IDs, also update Prisma:
  - `apps/api/prisma/schema.prisma` (`enum Category`)
  - Then reset/migrate your DB (local: `pnpm db:reset`)

## 3) Currency

- Edit `packages/config/currency.ts`
  - Default is `BBD` (`en-BB`)
  - Store/Admin formatting uses `formatMoney()`
- If you change currency, also update Prisma defaults in `apps/api/prisma/schema.prisma`

## 4) Shipping

- Edit `packages/config/shipping.ts`
  - Allowed countries (`allowedCountries`)
  - Rates (`rates.defaultCents`, `rates.parishOverrides`)
- If you change shipping defaults, also update Prisma defaults in `apps/api/prisma/schema.prisma`

## 5) Payments (Stripe)

Payments are currently simulated. When you wire Stripe in, you’ll typically add:

- API env vars (server-side)
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- Store/Admin env vars (client-side, Vite)
  - `VITE_STRIPE_PUBLISHABLE_KEY`

## 6) Seed a niche template

- Reset DB and seed baseline: `pnpm db:reset`
- Seed a niche dataset (example): `pnpm seed:niche phones`
  - Add more niches in `apps/api/src/seed.ts`

## 7) Deploy

- Follow `DEPLOYMENT.md` (Vercel for Store/Admin, Render blueprint for API).
- Set required API env vars:
  - `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET`
  - CORS vars: `CORS_ORIGIN_STORE`, `CORS_ORIGIN_ADMIN` (and optional preview settings)

## Optional later: Multi-tenant (“many stores from one codebase”)

When you want multiple stores from one codebase:

- Add a `tenant` table and route by subdomain (or path-based routing).
- Use separate Stripe accounts per tenant via Stripe Connect (bigger lift).
