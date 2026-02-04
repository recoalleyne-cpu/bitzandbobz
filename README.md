# Bitz Bobz App

A terminal-friendly monorepo for a Barbados-first e-commerce product.

## Apps

- `apps/store` - customer storefront (`http://localhost:5173`)
- `apps/admin` - admin dashboard (`http://localhost:5174`)
- `apps/api` - Express + Prisma API (`http://localhost:4000`)

## Golden Path (Local)

1. `pnpm db:up`
2. `pnpm db:reset`
3. `pnpm dev`

## What is implemented

- Real storefront flow: category filters, search, product detail, gallery, related products, stock availability.
- Checkout flow: persisted cart, Barbados-only shipping, BBD-only currency, quote + order submit.
- Admin flow: password login + token auth, product CRUD, stock management, order status updates.
- Analytics events: `view_product`, `add_to_cart`, `begin_checkout`, `purchase`, `search`, `filter_category`.
- Vendor-neutral automations queue (file-backed): order confirmation, low-stock alerts, daily summary queue, optional SMS/WhatsApp queueing.

## Docs

- `docs/DEPLOYMENT.md`
- `docs/HARDENING_CHECKLIST.md`
- `docs/AUTOMATIONS.md`
- `docs/PRODUCTIZATION.md`
- `docs/STARTER_CHECKLIST.md`
- `docs/MILESTONE3_LAUNCH.md`
