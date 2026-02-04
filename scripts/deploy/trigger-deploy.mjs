#!/usr/bin/env node

const target = process.argv[2];
if (!target || !['staging', 'production'].includes(target)) {
  console.error('Usage: node scripts/deploy/trigger-deploy.mjs <staging|production>');
  process.exit(1);
}

const hookKey = target === 'staging' ? 'DEPLOY_WEBHOOK_STAGING' : 'DEPLOY_WEBHOOK_PRODUCTION';
const hookUrl = process.env[hookKey];
if (!hookUrl) {
  console.error(`Missing ${hookKey}.`);
  process.exit(1);
}

const response = await fetch(hookUrl, { method: 'POST' });
if (!response.ok) {
  console.error(`Deploy hook failed: ${response.status}`);
  process.exit(1);
}

console.log(`${target} deploy triggered.`);
