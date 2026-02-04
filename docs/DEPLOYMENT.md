# Deployment Workflow

## Environments

### Staging

- Purpose: QA + approvals with safe data.
- Protect with password or basic auth.
- Use separate staging database and env vars.

### Production

- Purpose: real customers, real domain, real payments.
- Use managed Postgres with backups enabled.
- Lock down env vars and webhook secrets.

## Recommended stack

- Frontends (store/admin): Vercel or Netlify
- API: Render, Fly.io, or Railway
- Database: managed Postgres (Render/Railway/Supabase)
- File storage: S3-compatible (Cloudflare R2/AWS S3)

## Suggested pipeline

1. Push to feature branch
2. Auto deploy to staging
3. QA in staging URLs
4. Promote/merge to main
5. Auto deploy to production

## Environment variables

Store/Admin:
- `VITE_API_URL`

API:
- `DATABASE_URL`
- `PORT`
- `CORS_ORIGIN_STORE`
- `CORS_ORIGIN_ADMIN`
- `ADMIN_PASSWORD`
- `ADMIN_JWT_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- `ADMIN_DAILY_SUMMARY_EMAIL`
