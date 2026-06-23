#!/usr/bin/env node
// Refresh the local member session in .flynet-session.json before the access
// token expires. The refresh token is single-use and rotates, so this reads the
// current one, exchanges it for a fresh access + refresh token, and writes both
// back. The app's middleware does the same thing for the cookie session; this is
// the file-based equivalent for scripts and the app's file-session fallback.
//
// The token endpoint is a confidential client — it needs FLYNET_CLIENT_SECRET —
// so run with the env loaded (Node reads .env.local; this script never does):
//
//   One-shot:                 node --env-file=.env.local scripts/refresh-flynet-session.mjs
//   Only if near expiry:      node --env-file=.env.local scripts/refresh-flynet-session.mjs --if-expiring 300
//   Auto-refresh (watch):     node --env-file=.env.local scripts/refresh-flynet-session.mjs --watch
//   Watch, custom cadence:    ... --watch --every 60 --if-expiring 300
//
// Or via npm: `npm run token:refresh` (one-shot) / `npm run token:watch` (loop).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SESSION_FILE = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  ".flynet-session.json",
);
// Mirrors lib/env.ts: unset means production.
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || "https://api.blackbird.xyz/oauth";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i === -1 ? dflt : args[i + 1];
};
const WATCH = args.includes("--watch");
const EVERY = Number(flag("--every", 60)); // watch poll interval, seconds
// In watch mode default to a 300s safety window; one-shot defaults to "always".
const THRESHOLD = Number(flag("--if-expiring", WATCH ? 300 : 0));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

// Decode a JWT's exp claim (seconds) without verifying — just to record expiry.
function expFromJwt(jwt) {
  try {
    const payload = jwt.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp ?? null;
  } catch {
    return null;
  }
}

const clientId = process.env.FLYNET_CLIENT_ID;
const clientSecret = process.env.FLYNET_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  fail(
    "FLYNET_CLIENT_ID / FLYNET_CLIENT_SECRET not in env. Run with:\n" +
      "  node --env-file=.env.local scripts/refresh-flynet-session.mjs",
  );
}

// One refresh attempt. Returns "skipped" | "refreshed". Throws on a hard error
// (so the caller decides whether to exit or keep looping).
async function refreshOnce(threshold) {
  let session;
  try {
    session = JSON.parse(await readFile(SESSION_FILE, "utf8"));
  } catch {
    throw new Error(`Couldn't read ${SESSION_FILE}. Sign in, then save the session.`);
  }
  if (!session.refresh_token) throw new Error("No refresh_token in the session file.");

  if (threshold > 0) {
    const exp = session.expires_at_epoch ?? expFromJwt(session.access_token);
    const secondsLeft = exp ? exp - Math.floor(Date.now() / 1000) : 0;
    if (secondsLeft > threshold) {
      return { status: "skipped", secondsLeft };
    }
  }

  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });

  let res;
  try {
    res = await fetch(`${AUTH_BASE_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
    });
  } catch (err) {
    throw new Error(`Couldn't reach the token endpoint: ${err.message}`);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = data?.error_description || data?.error || `HTTP ${res.status}`;
    throw new Error(
      `Refresh rejected (${reason}). If it's invalid_grant the refresh token was ` +
        "already used or expired — sign in again to get a new one.",
    );
  }

  const exp = expFromJwt(data.access_token);
  await writeFile(
    SESSION_FILE,
    JSON.stringify(
      {
        ...session,
        access_token: data.access_token,
        // Refresh tokens rotate (single-use); keep the new one, fall back to old.
        refresh_token: data.refresh_token ?? session.refresh_token,
        token_type: data.token_type ?? session.token_type ?? "Bearer",
        scope: data.scope ?? session.scope,
        obtained_at: new Date().toISOString(),
        expires_at: exp ? new Date(exp * 1000).toISOString() : undefined,
        expires_at_epoch: exp ?? undefined,
      },
      null,
      2,
    ) + "\n",
  );
  return { status: "refreshed", expiresAt: exp ? new Date(exp * 1000).toISOString() : "(unknown)" };
}

const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);

if (!WATCH) {
  try {
    const r = await refreshOnce(THRESHOLD);
    if (r.status === "skipped") {
      console.log(`✓ Still fresh (${r.secondsLeft}s left, threshold ${THRESHOLD}s) — skipping.`);
    } else {
      console.log(`✓ Refreshed. New token expires ${r.expiresAt}.`);
    }
  } catch (err) {
    fail(err.message);
  }
} else {
  console.log(
    `▶ Watching ${SESSION_FILE}\n  every ${EVERY}s, refreshing when < ${THRESHOLD}s remain. Ctrl-C to stop.`,
  );
  // Loop forever. Transient errors are logged but don't kill the watcher, so a
  // blip recovers on the next tick; a fatal invalid_grant just keeps reminding
  // you to sign in again.
  for (;;) {
    try {
      const r = await refreshOnce(THRESHOLD);
      if (r.status === "refreshed") {
        console.log(`[${stamp()}] ✓ refreshed — expires ${r.expiresAt}`);
      } else {
        console.log(`[${stamp()}] · fresh (${r.secondsLeft}s left)`);
      }
    } catch (err) {
      console.error(`[${stamp()}] ✗ ${err.message}`);
    }
    await sleep(EVERY * 1000);
  }
}
