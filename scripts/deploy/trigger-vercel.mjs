#!/usr/bin/env node

const env = process.argv[2];
const app = process.argv[3] ?? "all";

if (!env || !["staging", "production"].includes(env)) {
  console.error("Usage: node scripts/deploy/trigger-vercel.mjs <staging|production> [store|admin|all]");
  process.exit(1);
}

if (!["store", "admin", "all"].includes(app)) {
  console.error("Usage: node scripts/deploy/trigger-vercel.mjs <staging|production> [store|admin|all]");
  process.exit(1);
}

const envKeySuffix = env === "staging" ? "STAGING" : "PRODUCTION";
const targets = app === "all" ? ["store", "admin"] : [app];

const hooks = targets.map((target) => {
  const key = `VERCEL_DEPLOY_HOOK_${target.toUpperCase()}_${envKeySuffix}`;
  return { target, key, url: process.env[key] };
});

const missing = hooks.filter((hook) => !hook.url).map((hook) => hook.key);
if (missing.length > 0) {
  console.error(`Missing deploy hook env vars: ${missing.join(", ")}`);
  process.exit(1);
}

async function triggerHook({ target, url }) {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(`${target} hook failed: ${response.status}`);
  }
}

try {
  await Promise.all(hooks.map((hook) => triggerHook(hook)));
  console.log(`Vercel ${env} deploy triggered (${targets.join(", ")}).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Deploy hook failed.");
  process.exit(1);
}

