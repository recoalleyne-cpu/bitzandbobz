# Productization Blueprint

## Make this sellable to niches

1. Theme tokens
   - Centralize colors/logo/brand name in config (`packages/config/brand.ts`).
2. Configurable categories
   - Manage category labels/order in config (`packages/config/categories.ts`).
3. Shipping rules
   - Start Barbados-only, then add country/parish rules by config (`packages/config/shipping.ts`).
4. Niche seed templates
   - Seed sample products per niche: `pnpm seed:niche phones` (edit `apps/api/src/seed.ts`).
5. Payments plugin model
   - Keep checkout contract stable, swap providers behind adapter layer.
6. Deploy docs
   - Keep staging/prod setup reproducible for clients.

## One-click deploy docs (target state)

- Required env vars
- Database setup script
- Seed command
- Healthcheck URL
- Rollback process

## Current reusable baseline

- Store + admin frontends separated
- API with authenticated admin endpoints
- Stock-aware products and order lifecycle
- Event logging + automation outbox for future integrations
