#!/usr/bin/env node

/**
 * Trigger Vercel Deploy Hooks for Store + Admin
 * Usage:
 *   node scripts/deploy/trigger-vercel.mjs staging [all|store|admin]
 *   node scripts/deploy/trigger-vercel.mjs production [all|store|admin]
 */

const env = process.env;

const mode = (process.argv[2] || "").toLowerCase();
if (!["staging", "production"].includes(mode)) {
  console.error(`Usage: node scripts/deploy/trigger-vercel.mjs <staging|production> [all|store|admin]`);
  process.exit(1);
}

const app = (process.argv[3] || "all").toLowerCase();
if (!["all", "store", "admin"].includes(app)) {
  console.error(`Usage: node scripts/deploy/trigger-vercel.mjs <staging|production> [all|store|admin]`);
  process.exit(1);
}

const VARS =
  mode === "staging"
    ? {
        store: "VERCEL_DEPLOY_HOOK_STORE_STAGING",
        admin: "VERCEL_DEPLOY_HOOK_ADMIN_STAGING",
      }
    : {
        store: "VERCEL_DEPLOY_HOOK_STORE_PRODUCTION",
        admin: "VERCEL_DEPLOY_HOOK_ADMIN_PRODUCTION",
      };

function getRequired(name) {
  const v = env[name];
  if (!v || typeof v !== "string" || !v.trim() || v.trim() === "...") return null;
  return v.trim();
}

const storeHook = getRequired(VARS.store);
const adminHook = getRequired(VARS.admin);

const missing = [];
if ((app === "all" || app === "store") && !storeHook) missing.push(VARS.store);
if ((app === "all" || app === "admin") && !adminHook) missing.push(VARS.admin);

if (missing.length) {
  console.error(`Missing deploy hook env vars: ${missing.join(", ")}`);
  process.exit(1);
}

async function trigger(label, url) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ triggeredBy: `pnpm deploy (${mode})`, app: label, mode }),
    });
  } catch (e) {
    console.error(`${label} hook network error:`, e?.message || e);
    process.exit(1);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`${label} hook failed: ${res.status}${text ? `\n${text}` : ""}`);
    process.exit(1);
  }

  console.log(`${label} hook triggered OK (${res.status})`);
}

if (app === "all" || app === "store") {
  await trigger("store", storeHook);
}
if (app === "all" || app === "admin") {
  await trigger("admin", adminHook);
}
console.log(`Done: ${mode}`);
