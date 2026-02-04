# Production Hardening Checklist

- [x] Admin auth + protected admin routes
- [x] API input validation (zod)
- [x] Barbados-only shipping and BBD-only currency checks
- [x] Rate limiting on auth/admin/checkout routes
- [x] Webhook signature verification (`PAYMENT_WEBHOOK_SECRET`)
- [x] CSV customer export endpoint (admin-protected)
- [x] Error log file capture (`apps/api/data/error.log`)
- [ ] Centralized error monitoring (Sentry or similar)
- [ ] Managed DB backups configured and tested
- [ ] Secrets rotated and managed in platform secret store
- [ ] Storefront SEO/performance pass

## Security reminders

- Never commit `.env` files.
- Do not reuse staging secrets in production.
- Restrict CORS origins to deployed URLs.
