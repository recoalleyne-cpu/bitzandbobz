#!/usr/bin/env node

const required = [
  'DATABASE_URL',
  'ADMIN_PASSWORD',
  'ADMIN_JWT_SECRET',
  'PAYMENT_WEBHOOK_SECRET',
  'CORS_ORIGIN_STORE',
  'CORS_ORIGIN_ADMIN',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Environment check passed.');
