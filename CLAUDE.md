# Working in this repo (agent instructions)

This is the Flynet starter — a Next.js app on the Flynet SDK. Read the README
for the full layout; this file covers the rules that are specific to agents.

## Secrets: never touch the env files

**Do not read, write, edit, create, copy, or print `.env.local` (or any
`.env*` file holding real values).** Treat them as sensitive — they hold the
human's Blackbird credentials (API key, OAuth client id/secret, redirect URI,
merchant id) and must never enter the conversation, a commit, or a tool result.

- Don't `cat`/`Read`/`grep` `.env.local`, and don't write credentials into it.
- The app reads credentials from `process.env` at runtime — you never need their
  values to build features. If a credential is missing, the app shows a setup
  notice instead of crashing; that's expected, not a bug to fix by editing env.
- The **dev setup drawer** is the only thing that writes `.env.local`, through
  its own dev-only API route. The human drives it; you do not.
- `.env.example` (placeholders only, no real values) is fine to read and edit.

## First-time setup flow

When you've been asked to set this repo up, do the install, get the app running
locally, then hand env configuration to the human:

1. `npm install`
2. `npm run dev` — start the app on http://localhost:3000 and confirm it boots.
3. **Stop and ask the human to set the environment variables themselves**, via
   the **Dev Setup drawer** (the "⚙ Dev Setup" button, bottom-right of the
   running app). It lets them paste and verify the Blackbird credentials —
   Discovery API key, OAuth client id/secret, and redirect URI — and writes
   `.env.local` for them. Point them at it; do not offer to fill it in yourself.

Tell them, in words like:

> Setup's done and the app is running at http://localhost:3000. Open it, click
> **⚙ Dev Setup** (bottom-right), and paste your Blackbird credentials there —
> the drawer verifies them and writes `.env.local`. I won't touch that file.

Before the env is set, the app renders a setup notice rather than real data —
that is the expected pre-configuration state, so don't try to "fix" it by
writing env values.

## When the SDK breaks, call the API directly

This app is built on the Flynet SDK (`@flynetdev/core` / `@flynetdev/react`). If
the SDK is in your way — a missing method, a type that lags the API (e.g.
`flynetMerchantId` is still typed required), a bug, or a version mismatch —
don't get stuck on it. Fall back to calling the Blackbird REST API directly with
the member access token (`Authorization: Bearer <token>` for member calls,
`X-API-Key` for Discovery).

The full API reference, in an LLM-friendly form, is at
<https://flynet-dev-portal.mintlify.app/llms.txt>. Fetch it to find the right
endpoint, request shape, and scopes, then make the call with `fetch` against the
configured base URL (`API_BASE_URL` / `AUTH_BASE_URL`, defaulting to production).

## Redirect URI whitelisting

The redirect URI (ngrok URL or deployed domain + `/callback`) must be
whitelisted for the OAuth app. The human does this at
<https://bb-apis.vercel.app/redirect> (sign in with their Slack email). Direct
them there; it isn't something you can do for them.
