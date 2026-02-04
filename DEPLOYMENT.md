# Deployment (Staging + Production)

This repo has 3 deployable apps:

- `apps/store` (Vite storefront) → Vercel
- `apps/admin` (Vite admin) → Vercel
- `apps/api` (Express + Prisma) → Render/Fly/Railway (Render blueprint included)

## 1) Create the environments

### Staging

- Store URL (example): `https://bitz-bobz-store-staging.vercel.app`
- Admin URL (example): `https://bitz-bobz-admin-staging.vercel.app`
- API URL (example): `https://bitz-bobz-api-staging.onrender.com`

### Production

- Store URL (example): `https://bitz-bobz-store.vercel.app` (or custom domain)
- Admin URL (example): `https://bitz-bobz-admin.vercel.app` (or custom domain)
- API URL (example): `https://bitz-bobz-api-production.onrender.com` (or custom domain)

## 2) Deploy Store/Admin on Vercel (repeatable)

Recommended approach: **separate Vercel projects for staging vs production** so each environment has a stable URL.

### 2.1 Create 4 Vercel projects

Create these projects in Vercel (names are examples):

- `bitz-bobz-store-staging` → Root Directory: `apps/store` → Production Branch: `staging`
- `bitz-bobz-store` → Root Directory: `apps/store` → Production Branch: `main`
- `bitz-bobz-admin-staging` → Root Directory: `apps/admin` → Production Branch: `staging`
- `bitz-bobz-admin` → Root Directory: `apps/admin` → Production Branch: `main`

The per-app `vercel.json` files set the build/install/output settings.

### 2.2 Set Vercel environment variables

In each Vercel project, set:

- `VITE_API_URL`

Suggested values:

- Store/Admin **staging** projects: your staging API base URL
- Store/Admin **production** projects: your production API base URL

Tip: also set `VITE_API_URL` for Preview deployments (so feature-branch previews still work).

### 2.3 Create Vercel Deploy Hooks

In each Vercel project:

`Project Settings → Git → Deploy Hooks` → create a hook and copy the URL.

You need 4 hook URLs total:

- Store staging
- Store production
- Admin staging
- Admin production

### 2.4 Trigger deploys locally

Export the hook URLs in your shell (or put them in your CI secrets):

```bash
export VERCEL_DEPLOY_HOOK_STORE_STAGING="https://api.vercel.com/v1/integrations/deploy/..."
export VERCEL_DEPLOY_HOOK_STORE_PRODUCTION="https://api.vercel.com/v1/integrations/deploy/..."
export VERCEL_DEPLOY_HOOK_ADMIN_STAGING="https://api.vercel.com/v1/integrations/deploy/..."
export VERCEL_DEPLOY_HOOK_ADMIN_PRODUCTION="https://api.vercel.com/v1/integrations/deploy/..."
```

Then deploy:

```bash
pnpm deploy:vercel:staging
pnpm deploy:vercel:production
```

Or target a single app:

```bash
pnpm deploy:vercel:store:staging
pnpm deploy:vercel:admin:production
```

## 3) Deploy API (Render blueprint included)

This repo includes `render.yaml` for a staging + production API and Postgres.

### 3.1 Create Render services from `render.yaml`

- Create the blueprint in Render from this repo.
- Set the secrets (`ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET`, etc.) in the Render dashboard.
- Run migrations/seed as needed (see `pnpm db:reset` for local; for Render, use Prisma in a one-off job/shell).

### 3.2 Configure CORS for Vercel production + preview domains

The API supports explicit origins and Vercel preview origins.

Set these on the API service:

- `CORS_ORIGIN_STORE` = the Store URL for this environment (staging or production)
- `CORS_ORIGIN_ADMIN` = the Admin URL for this environment (staging or production)
- `CORS_ALLOW_VERCEL_PREVIEW` = `true`
- `CORS_ALLOWED_VERCEL_PROJECTS` = `bitz-bobz-store,bitz-bobz-admin` (adjust to your Vercel project names)

If you want to allow additional explicit origins (comma-separated), add:

- `CORS_ORIGINS` = `https://bitz-bobz-store-staging.vercel.app,https://bitz-bobz-admin-staging.vercel.app`

## 4) Verify deployments

1. `curl -fsS "$API_URL/health"` → should return `{ "ok": true }`
2. Open Store URL → catalog should load (otherwise it will show an API unreachable message)
3. Open Admin URL → login should work and data should load
