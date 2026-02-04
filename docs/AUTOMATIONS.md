# Analytics and Automations

## Tracked analytics events

- `view_product`
- `add_to_cart`
- `begin_checkout`
- `purchase`
- `search`
- `filter_category`

Events are currently stored in `apps/api/data/analytics-events.json` (vendor-neutral).

## Built-in automations (queued)

Notifications are written to `apps/api/data/notification-outbox.json`:

- Order confirmation email (on checkout submit)
- Low-stock alert email (when stock reaches <= 5)
- Daily sales summary email (queued via `/admin/automations/daily-sales-email`)
- Optional manual notifications (email/sms/whatsapp) via `/admin/automations/notify`

## Integration strategy

Keep core event and queue formats provider-neutral.
Then add provider-specific workers:

- Email: SES/Resend/Postmark
- SMS/WhatsApp: Twilio/MessageBird
- Analytics forwarders: Segment/PostHog/etc
