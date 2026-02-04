# Milestone 3 (Launch)

## Goal

Ship a safe review flow (staging) and a controlled production deployment with analytics + automations enabled.

## Staging flow

- Frontend staging targets:
  - Store: `bitz-bobz-store-staging.vercel.app`
  - Admin: `bitz-bobz-admin-staging.vercel.app`
- API staging target: `bitz-bobz-api-staging` (Render)
- Use staging DB and staging secrets only.

## Production flow

- Frontend production targets:
  - Store: your real domain (example: `shop.bitzbobz.com`)
  - Admin: protected admin domain/subdomain
- API production target: `bitz-bobz-api-production` (Render)
- Production deploy is manual and gated via workflow dispatch.

## What was added

- Render blueprint: `render.yaml`
- Vercel configs:
  - `apps/store/vercel.json`
  - `apps/admin/vercel.json`
- CI/CD workflow:
  - `.github/workflows/launch.yml`
- Deploy scripts:
  - `pnpm deploy:check`
  - `pnpm deploy:staging`
  - `pnpm deploy:production`

## Analytics + automations status

Implemented and live in API:
- Events: `view_product`, `add_to_cart`, `begin_checkout`, `purchase`, `search`, `filter_category`
- Queue-backed automations:
  - Order confirmation email
  - Low-stock alerts
  - Daily sales summary email
  - Manual email/SMS/WhatsApp queueing

Storage:
- `apps/api/data/analytics-events.json`
- `apps/api/data/notification-outbox.json`
- `apps/api/data/payment-events.json`

## Required CI/CD secrets

Set these in GitHub Actions:
- `DEPLOY_WEBHOOK_STAGING`
- `DEPLOY_WEBHOOK_PRODUCTION`

## Recommended next step

Attach a worker process to consume `notification-outbox.json` and forward to real providers (Resend/Twilio/WhatsApp) in production.
