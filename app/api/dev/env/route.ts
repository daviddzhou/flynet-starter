import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { blockInProduction } from "../../../../lib/dev-only";

// Backend for the dev onboarding drawer's first step: report which Blackbird
// credentials are configured, and let the developer write them into .env.local
// from the UI. On save we verify the values against the live API before
// persisting — never store credentials we already know are broken.
// Dev-only — see lib/dev-only.ts.
const ENV_PATH = join(process.cwd(), ".env.local");

// The credentials the setup drawer manages. Order is the order they're appended
// to .env.local on first write.
const FIELDS = [
  "FLYNET_API_KEY",
  "FLYNET_CLIENT_ID",
  "FLYNET_CLIENT_SECRET",
  "REDIRECT_URI",
] as const;
type Field = (typeof FIELDS)[number];

// Which fields are secrets. Secrets are masked in the status preview; the
// redirect URI is just a URL, so we show it in full to make it easy to confirm.
const SECRET_FIELDS = new Set<Field>([
  "FLYNET_API_KEY",
  "FLYNET_CLIENT_ID",
  "FLYNET_CLIENT_SECRET",
]);

// Same production defaults the SDK / lib/locations.ts use (unset env = production).
const DISCOVERY_URL =
  process.env.API_BASE_URL || "https://api.blackbird.xyz/flynet/v1";
const AUTH_URL =
  process.env.AUTH_BASE_URL || "https://api.blackbird.xyz/oauth";

type FieldStatus = { isSet: boolean; masked: string | null };

// Show enough of a secret to recognise it without leaking the whole thing.
function mask(value: string): string {
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
}

function fieldStatus(name: Field): FieldStatus {
  const value = process.env[name]?.trim() ?? "";
  if (!value) return { isSet: false, masked: null };
  return { isSet: true, masked: SECRET_FIELDS.has(name) ? mask(value) : value };
}

function snapshot(): Record<Field, FieldStatus> {
  return Object.fromEntries(FIELDS.map((f) => [f, fieldStatus(f)])) as Record<
    Field,
    FieldStatus
  >;
}

// GET → per-credential status (set + masked preview).
export async function GET() {
  const blocked = blockInProduction();
  if (blocked) return blocked;
  return NextResponse.json(snapshot());
}

// Verify the Discovery API key with the cheapest authenticated read we can make.
// 401/403 means the key is wrong; any 2xx means it works. Returns an error
// string, or null when the key checks out.
async function validateApiKey(apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${DISCOVERY_URL}/restaurants?limit=1`, {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return null;
    if (res.status === 401 || res.status === 403) {
      return "Discovery rejected this API key (unauthorized).";
    }
    return `Discovery returned HTTP ${res.status} while checking the key.`;
  } catch {
    return "Couldn't reach Discovery to verify the API key.";
  }
}

// Verify the OAuth client credentials at the token endpoint. We can't run the
// full authorization-code flow from here, so we send a client_credentials
// request purely to authenticate the client. The server separates "who is the
// client" from "is this grant allowed": `invalid_client` (or a 401) means the
// id/secret are wrong, while any other outcome — a token, or even an error like
// unsupported_grant_type — means the client authenticated and only the grant
// was refused. That's enough to catch typo'd credentials.
async function validateOAuthClient(
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${AUTH_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    const code = typeof data.error === "string" ? data.error : "";
    if (res.status === 401 || code === "invalid_client") {
      return "The OAuth server rejected the client id / secret.";
    }
    // Client authenticated; only the grant was refused → credentials are valid.
    return null;
  } catch {
    return "Couldn't reach the OAuth server to verify the client credentials.";
  }
}

// The redirect URI isn't an API credential we can verify remotely, but we can
// catch the mistakes that silently break sign-in: it has to be an absolute
// http(s) URL ending in /callback (the path app/callback/route.ts handles).
function validateRedirectUri(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Enter an absolute URL, e.g. https://<subdomain>.ngrok.app/callback.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "The redirect URI must be an http(s) URL.";
  }
  if (!url.pathname.endsWith("/callback")) {
    return "The redirect URI must end in /callback.";
  }
  return null;
}

// Replace every existing line for `name` with a single fresh one (deduping any
// pre-existing repeats), or append it if absent. Returns the new file contents.
function upsertEnv(contents: string, name: string, value: string): string {
  const line = `${name}="${value}"`;
  const isKeyLine = new RegExp(`^${name}=`);
  const lines = contents.split("\n");
  const out: string[] = [];
  let placed = false;
  for (const l of lines) {
    if (isKeyLine.test(l)) {
      if (!placed) {
        out.push(line); // keep the first occurrence's position
        placed = true;
      }
      continue; // drop any later duplicates
    }
    out.push(l);
  }
  if (!placed) {
    // Append, slotting in before a trailing empty line if there is one.
    if (out.length && out[out.length - 1] === "") out.splice(-1, 0, line);
    else out.push(line);
  }
  return out.join("\n");
}

// POST { values: { FLYNET_API_KEY?, FLYNET_CLIENT_ID?, ... } }
// Validates the provided credentials, then writes them to .env.local (creating
// it if needed) without leaving duplicates, and mirrors them into the running
// process so a follow-up GET reflects them before Next reloads the file.
export async function POST(req: Request) {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  let body: { values?: Partial<Record<Field, string>> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Trimmed, non-empty values the caller wants to set.
  const updates: Partial<Record<Field, string>> = {};
  for (const f of FIELDS) {
    const v = body.values?.[f]?.trim();
    if (v) updates[f] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No credentials provided." }, { status: 400 });
  }

  // Effective value = the incoming update, else whatever's already in env.
  const effective = (f: Field) => updates[f] ?? process.env[f]?.trim() ?? "";
  const fieldErrors: Partial<Record<Field, string>> = {};

  // Validate the API key on its own.
  if (updates.FLYNET_API_KEY) {
    const err = await validateApiKey(updates.FLYNET_API_KEY);
    if (err) fieldErrors.FLYNET_API_KEY = err;
  }

  // The client id + secret are a pair — verify whenever either is changing.
  if (updates.FLYNET_CLIENT_ID || updates.FLYNET_CLIENT_SECRET) {
    const id = effective("FLYNET_CLIENT_ID");
    const secret = effective("FLYNET_CLIENT_SECRET");
    if (!id || !secret) {
      const missing: Field = !id ? "FLYNET_CLIENT_ID" : "FLYNET_CLIENT_SECRET";
      fieldErrors[missing] = "Set both the client id and secret to verify them.";
    } else {
      const err = await validateOAuthClient(id, secret);
      if (err) {
        // Attribute the pair error to whichever field(s) the caller sent.
        if (updates.FLYNET_CLIENT_ID) fieldErrors.FLYNET_CLIENT_ID = err;
        if (updates.FLYNET_CLIENT_SECRET) fieldErrors.FLYNET_CLIENT_SECRET = err;
      }
    }
  }

  // The redirect URI is validated by shape only — no network call.
  if (updates.REDIRECT_URI) {
    const err = validateRedirectUri(updates.REDIRECT_URI);
    if (err) fieldErrors.REDIRECT_URI = err;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: "Some credentials didn't verify.", fieldErrors },
      { status: 422 },
    );
  }

  // All good — persist them.
  let contents = "";
  try {
    contents = await readFile(ENV_PATH, "utf8");
  } catch {
    contents = "";
  }
  for (const [name, value] of Object.entries(updates) as [Field, string][]) {
    contents = upsertEnv(contents, name, value);
    process.env[name] = value;
  }
  if (!contents.endsWith("\n")) contents += "\n";
  await writeFile(ENV_PATH, contents, "utf8");

  return NextResponse.json(snapshot());
}
