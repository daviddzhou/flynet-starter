"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Developer onboarding drawer. Renders only in dev (layout.tsx gates it on
// NODE_ENV), and its backend routes 404 in production too. It has two views,
// switched by the `view` state and a back affordance in the header:
//   • setup    — get the starter running (Blackbird credentials, ngrok tunnel).
//   • deploy   — "I'm ready to deploy": how to ship to Vercel and which env
//                vars to set there. Pure UI, copies to clipboard.
// Everything talks to /api/dev/* — nothing here touches real secrets directly.

type FieldStatus = { isSet: boolean; masked: string | null };
// Step 2's backend reports the public URL sign-in redirects back to, plus which
// environment produced it: a Codespace forwards a URL automatically, local dev
// gets one from a running ngrok agent. The UI branches on `kind`.
type TunnelStatus = {
  running: boolean;
  url: string | null;
  kind: "codespaces" | "ngrok";
};

type View = "setup" | "deploy";

// The Blackbird credentials the setup step manages, in display order. `name`
// matches the .env.local key the backend writes; `validates` notes how the
// server checks it so the UI can explain what "Save & verify" actually does.
type CredField =
  | "FLYNET_API_KEY"
  | "FLYNET_CLIENT_ID"
  | "FLYNET_CLIENT_SECRET"
  | "REDIRECT_URI";

const CREDENTIALS: {
  name: CredField;
  label: string;
  help: string;
  // Secrets render as password fields and are masked once set; the redirect URI
  // is a plain URL, so it's shown in full to make it easy to confirm.
  secret: boolean;
  placeholder?: string;
}[] = [
  {
    name: "FLYNET_API_KEY",
    label: "Discovery API key",
    help: "Sent as X-API-Key for restaurant data. Server-side only.",
    secret: true,
  },
  {
    name: "FLYNET_CLIENT_ID",
    label: "OAuth client ID",
    help: "Powers “Sign in with Blackbird”.",
    secret: true,
  },
  {
    name: "FLYNET_CLIENT_SECRET",
    label: "OAuth client secret",
    help: "Backend-only — never reaches the browser.",
    secret: true,
  },
  {
    name: "REDIRECT_URI",
    label: "Redirect URI",
    help: "Your ngrok (or deployed) https URL + /callback. Whitelist it at make.flynet.org (sign in with your Slack email).",
    secret: false,
    placeholder: "https://<subdomain>.ngrok.app/callback",
  },
];

type CredStatus = Record<CredField, FieldStatus>;

// Other components (e.g. the page's "get started" callout when env is missing)
// open the drawer by dispatching this event, so they don't need a shared store.
export const OPEN_DEV_SETUP_EVENT = "flynet:open-dev-setup";

export function DevDrawer() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("setup");

  const close = useCallback(() => setOpen(false), []);

  // Let anything on the page open the drawer (always on the setup view).
  useEffect(() => {
    const onOpen = () => {
      setView("setup");
      setOpen(true);
    };
    window.addEventListener(OPEN_DEV_SETUP_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DEV_SETUP_EVENT, onOpen);
  }, []);

  // Escape steps back to the setup view first, then closes — so it never
  // surprises you by dismissing the whole drawer when you only meant to leave a
  // sub-view.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setView((v) => {
        if (v !== "setup") return "setup";
        setOpen(false);
        return v;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Always reopen on the setup view, regardless of where we left off.
  useEffect(() => {
    if (!open) setView("setup");
  }, [open]);

  // Per-view header copy.
  const HEADER: Record<View, { eyebrow: string; title: string }> = {
    setup: { eyebrow: "Developer Setup", title: "Get this starter running" },
    deploy: { eyebrow: "Deploy", title: "Ship it to Vercel" },
  };

  return (
    <>
      {/* Floating launcher — bottom-right, out of the app's way. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex h-11 items-center gap-2 rounded-full border border-strong bg-surface px-4 text-sm font-semibold text-foreground shadow-lg transition duration-150 ease-standard hover:bg-surface-high"
        aria-label="Open developer setup"
      >
        <span className="text-base leading-none">⚙</span>
        Dev Setup
      </button>

      {/* Scrim + panel mount/unmount together, animated by framer-motion. */}
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              key="scrim"
              onClick={close}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60"
            />

            <motion.aside
              key="panel"
              role="dialog"
              aria-modal="true"
              aria-label="Developer setup"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-strong bg-background-darker"
            >
              <header className="flex items-start justify-between gap-4 border-b border-strong p-6">
                <div className="flex items-start gap-3">
                  {/* Back to setup from a sub-view. */}
                  <AnimatePresence initial={false}>
                    {view !== "setup" ? (
                      <motion.button
                        key="back"
                        type="button"
                        onClick={() => setView("setup")}
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="-ml-2 mt-0.5 overflow-hidden rounded-full p-2 text-muted transition hover:bg-surface hover:text-foreground"
                        aria-label="Back to setup"
                      >
                        ←
                      </motion.button>
                    ) : null}
                  </AnimatePresence>
                  {/* Header copy crossfades as the view changes. */}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={view}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-primary-bright">
                        {HEADER[view].eyebrow}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold tracking-tight">
                        {HEADER[view].title}
                      </h2>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="-mr-2 -mt-1 rounded-full p-2 text-muted transition hover:bg-surface hover:text-foreground"
                  aria-label="Close"
                >
                  ✕
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Each view slides + fades in. Sub-views enter from the right
                    (drill in); setup enters from the left (back out). Keying on
                    `view` lets AnimatePresence run the exit→enter handoff. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={view}
                    initial={{ opacity: 0, x: view === "setup" ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: view === "setup" ? 20 : -20 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="space-y-6"
                  >
                    {view === "setup" ? <SetupView setView={setView} /> : null}
                    {view === "deploy" ? <DeployView /> : null}
                  </motion.div>
                </AnimatePresence>
              </div>

              <footer className="border-t border-strong p-4 text-center text-[11px] text-subtle">
                Dev-only panel · hidden in production builds
              </footer>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

// A button that opens the dev drawer from anywhere on the page (used by the
// page's "get started" callout when the app has no credentials yet). It just
// fires OPEN_DEV_SETUP_EVENT; DevDrawer listens. Safe to render in a Server
// Component tree since it's a Client Component itself.
export function OpenDevSetupButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_DEV_SETUP_EVENT))}
      className={className}
    >
      {children}
    </button>
  );
}

// ── Setup view ───────────────────────────────────────────────────────────────
// Holds the two setup steps plus the nav cards. It owns a `credReloadToken` so
// the ngrok step can poke the credentials step to refetch its status — used
// when "Use as Redirect URI" writes REDIRECT_URI, so it flips to ✓ Configured
// without the developer reopening the drawer.
function SetupView({ setView }: { setView: (v: View) => void }) {
  const [credReloadToken, setCredReloadToken] = useState(0);
  return (
    <>
      <CredentialsStep reloadToken={credReloadToken} />
      <TunnelStep onRedirectUriSaved={() => setCredReloadToken((t) => t + 1)} />
      <NavCard
        title="I'm ready to deploy"
        hint="Ship to Vercel — push, import, and set your env vars there."
        onClick={() => setView("deploy")}
      />
    </>
  );
}

// ── Step 1: Blackbird credentials ────────────────────────────────────────────
// API key + OAuth client id/secret + redirect URI. Saving runs the secrets
// through the live API (Discovery for the key, the OAuth token endpoint for the
// client pair) and shape-checks the redirect URI before any of them are written
// to .env.local — so a typo is caught here, not at runtime.
function CredentialsStep({ reloadToken }: { reloadToken?: number }) {
  const [status, setStatus] = useState<CredStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Partial<Record<CredField, string>>>({});
  const [editing, setEditing] = useState<Partial<Record<CredField, boolean>>>({});
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<CredField, string>>
  >({});
  const [topError, setTopError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/env");
      setStatus((await res.json()) as CredStatus);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch when a sibling step changes the env (e.g. ngrok writing
  // REDIRECT_URI). Skip the initial 0 — the mount effect above already loaded.
  useEffect(() => {
    if (reloadToken) load();
  }, [reloadToken, load]);

  const isShown = (f: CredField) => !status?.[f]?.isSet || editing[f];
  // Anything the developer has typed into a visible field.
  const pending = CREDENTIALS.filter((c) => isShown(c.name)).reduce(
    (acc, c) => {
      const v = values[c.name]?.trim();
      if (v) acc[c.name] = v;
      return acc;
    },
    {} as Partial<Record<CredField, string>>,
  );

  async function save() {
    if (Object.keys(pending).length === 0) return;
    setSaving(true);
    setTopError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const res = await fetch("/api/dev/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: pending }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        throw new Error(data.error ?? "Could not save the credentials.");
      }
      setStatus(data as CredStatus);
      // Clear only the fields we just saved.
      setValues((v) => {
        const next = { ...v };
        for (const k of Object.keys(pending)) delete next[k as CredField];
        return next;
      });
      setEditing((e) => {
        const next = { ...e };
        for (const k of Object.keys(pending)) delete next[k as CredField];
        return next;
      });
      setSaved(true);
    } catch (e) {
      setTopError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const allSet =
    status != null && CREDENTIALS.every((c) => status[c.name].isSet);

  return (
    <Section
      index={1}
      title="Blackbird credentials"
      done={allSet}
      hint="API key, OAuth client id/secret, and redirect URI. Verified, then written to .env.local."
    >
      {loading ? (
        <Skeleton />
      ) : (
        <div className="space-y-4">
          {CREDENTIALS.map((cred) => {
            const set = status?.[cred.name]?.isSet ?? false;
            const shown = isShown(cred.name);
            const err = fieldErrors[cred.name];
            return (
              <div key={cred.name} className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {cred.label}
                  </span>
                  <code className="font-mono text-[11px] text-subtle">
                    {cred.name}
                  </code>
                  {set && !editing[cred.name] ? (
                    <button
                      type="button"
                      onClick={() =>
                        setEditing((e) => ({ ...e, [cred.name]: true }))
                      }
                      className="ml-auto text-xs text-primary-bright underline-offset-2 hover:underline"
                    >
                      Replace
                    </button>
                  ) : null}
                </div>

                {set && !editing[cred.name] ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="shrink-0 text-success">✓ Configured</span>
                    {/* A masked secret is struck through to read as "stored,
                        replaceable"; the plain redirect URL is shown as-is. */}
                    <code
                      className={`truncate font-mono text-muted ${
                        cred.secret ? "line-through" : ""
                      }`}
                    >
                      {status?.[cred.name]?.masked}
                    </code>
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-subtle">
                    {cred.help}
                  </p>
                )}

                {shown ? (
                  <input
                    type={cred.secret ? "password" : "text"}
                    value={values[cred.name] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [cred.name]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save();
                    }}
                    placeholder={cred.placeholder ?? `Paste your ${cred.name}`}
                    className={`w-full rounded-xl border bg-surface-low px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none ${
                      err
                        ? "border-failure focus:border-failure"
                        : "border-strong focus:border-primary"
                    }`}
                    autoComplete="off"
                    spellCheck={false}
                  />
                ) : null}

                {err ? <p className="text-xs text-failure">{err}</p> : null}
              </div>
            );
          })}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={saving || Object.keys(pending).length === 0}
              className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Verifying…" : "Save & verify"}
            </button>
            {saved && !saving ? (
              <span className="text-xs text-success">Saved & verified ✓</span>
            ) : null}
            {topError && !saving ? (
              <span className="text-xs text-failure">{topError}</span>
            ) : null}
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Step 2: ngrok ────────────────────────────────────────────────────────────
// Hand this to the agent so it does the tunnel setup — adds the authtoken and
// starts the tunnel — without the dev juggling a second terminal. The agent
// stops at reporting the URL: it never writes .env.local (the dev sets
// REDIRECT_URI with the "Use as Redirect URI" button here). The dev pastes
// their token where marked before sending it.
const AGENT_TUNNEL_PROMPT =
  "My ngrok authtoken is: <paste it here>. Add it with " +
  "`ngrok config add-authtoken`, start a tunnel to port 3000 " +
  "(`ngrok http 3000`), and tell me the public https URL. Don't touch " +
  ".env.local — I'll set REDIRECT_URI from the dev setup drawer.";

function TunnelStep({
  onRedirectUriSaved,
}: {
  onRedirectUriSaved?: () => void;
}) {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [settingRedirect, setSettingRedirect] = useState(false);
  const [redirectMsg, setRedirectMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/tunnel");
      setStatus((await res.json()) as TunnelStatus);
    } catch {
      setStatus({ running: false, url: null, kind: "ngrok" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // What actually gets whitelisted and saved as REDIRECT_URI: the tunnel URL
  // plus /callback. Display and copy THIS (not the bare host) so what you paste
  // into the whitelist matches what "Use as Redirect URI" saves.
  const callbackUrl = status?.url
    ? `${status.url.replace(/\/+$/, "")}/callback`
    : null;

  async function copy() {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the URL is visible regardless.
    }
  }

  // Save the callback URL straight into REDIRECT_URI via the same endpoint the
  // credentials step uses, then tell that step to refresh so it shows the
  // redirect URI as configured. The server validates the shape.
  async function useAsRedirect() {
    if (!callbackUrl) return;
    const redirectUri = callbackUrl;
    setSettingRedirect(true);
    setRedirectMsg(null);
    try {
      const res = await fetch("/api/dev/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: { REDIRECT_URI: redirectUri } }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.fieldErrors?.REDIRECT_URI ??
            data.error ??
            "Couldn't set the redirect URI.",
        );
      }
      setRedirectMsg({ ok: true, text: "Saved ✓ — now whitelist it below ↓" });
      onRedirectUriSaved?.();
    } catch (e) {
      setRedirectMsg({
        ok: false,
        text: e instanceof Error ? e.message : "Couldn't set it.",
      });
    } finally {
      setSettingRedirect(false);
    }
  }

  const running = status?.running ?? false;
  const kind = status?.kind ?? "ngrok";
  const isCodespace = kind === "codespaces";

  return (
    <Section
      index={2}
      title={isCodespace ? "Cloud preview URL" : "ngrok tunnel"}
      done={running}
      hint={
        isCodespace
          ? "Public URL for sign-in — auto-detected from your Codespace."
          : "Public URL for local sign-in — Blackbird blocks localhost."
      }
      action={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-primary-bright underline-offset-2 hover:underline disabled:opacity-40"
        >
          {loading ? "Checking…" : "Re-check"}
        </button>
      }
    >
      {loading ? (
        <Skeleton />
      ) : running ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-success">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            {isCodespace ? "Codespace preview is live" : "ngrok is running"}
          </div>
          <button
            type="button"
            onClick={copy}
            title="Copy callback URL"
            className="flex w-full items-center gap-2 rounded-xl border border-strong bg-surface-low px-3 py-2 text-left font-mono text-xs text-foreground transition hover:bg-surface"
          >
            <span className="truncate">{callbackUrl}</span>
            <span className="ml-auto shrink-0 text-[11px] text-muted">
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>

          {/* One-click: write <tunnel>/callback into REDIRECT_URI so the dev
              doesn't have to copy, append /callback, and paste it up top. */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={useAsRedirect}
              disabled={settingRedirect}
              className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              {settingRedirect ? "Setting…" : "Use as Redirect URI →"}
            </button>
            {redirectMsg ? (
              <span
                className={`text-xs ${redirectMsg.ok ? "text-success" : "text-failure"}`}
              >
                {redirectMsg.text}
              </span>
            ) : null}
          </div>

          {/* Codespaces forwards new ports as private (they require a GitHub
              login), so the Blackbird redirect can't reach the callback until
              port 3000 is flipped to Public. This is the one manual Codespaces
              step the platform won't let us do for you. */}
          {isCodespace ? (
            <p className="rounded-lg border border-brand-yellow/30 bg-brand-yellow/10 px-3 py-2 text-xs leading-relaxed text-brand-yellow">
              Set port <code className="font-mono">3000</code> to{" "}
              <strong>Public</strong> in the <strong>Ports</strong> panel (or run{" "}
              <code className="font-mono">
                gh codespace ports visibility 3000:public
              </code>
              ) — sign-in can&apos;t reach a private Codespace port.
            </p>
          ) : null}

          {/* The tunnel URL only works for OAuth once its /callback is
              whitelisted on the Blackbird side — point the dev at the self-serve
              portal so they can add it themselves. */}
          <p className="rounded-lg border border-brand-yellow/30 bg-brand-yellow/10 px-3 py-2 text-xs leading-relaxed text-brand-yellow">
            Whitelist <code className="font-mono">{callbackUrl}</code> for the
            Blackbird API: sign in with your Slack email at{" "}
            <a
              href="https://make.flynet.org/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              make.flynet.org
            </a>{" "}
            and add it there.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-failure" />
            ngrok is not running
          </div>

          {/* First run only: ngrok refuses to tunnel without an authtoken, and
              a bare `ngrok http 3000` fails with an opaque error if you skip it.
              Point first-timers at the free signup before they hit that wall. */}
          <p className="rounded-lg border border-brand-yellow/30 bg-brand-yellow/10 px-3 py-2 text-xs leading-relaxed text-brand-yellow">
            First time with ngrok? Grab a free authtoken at{" "}
            <a
              href="https://dashboard.ngrok.com/get-started/your-authtoken"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              ngrok.com
            </a>{" "}
            — then either run{" "}
            <code className="font-mono">ngrok config add-authtoken &lt;token&gt;</code>{" "}
            yourself, or paste the token into the prompt below and let your agent
            set it up.
          </p>

          {/* Easiest path: hand the agent the token; it does the whole setup. */}
          <p className="text-xs text-subtle">
            Ask your agent (paste your authtoken in first):
          </p>
          <div className="flex items-start gap-2 rounded-xl border border-strong bg-surface-low px-3 py-2">
            <code className="flex-1 font-mono text-xs leading-relaxed text-foreground">
              {AGENT_TUNNEL_PROMPT}
            </code>
            <CopyIconButton text={AGENT_TUNNEL_PROMPT} label="Copy prompt" />
          </div>

          {/* Or do it by hand. Once it's up, Re-check and the "Use as Redirect
              URI" button appears to set REDIRECT_URI for you. */}
          <p className="text-xs text-subtle">
            Or run it yourself, then Re-check above:
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-strong bg-surface-low px-3 py-2">
            <code className="flex-1 font-mono text-xs text-foreground">
              ngrok http 3000
            </code>
            <CopyIconButton text="ngrok http 3000" label="Copy command" />
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Deploy view: ship to Vercel ──────────────────────────────────────────────
// Hand this to the agent to do the whole deploy — push, create the project, set
// the secrets, and report back the callback URL to whitelist.
const DEPLOY_AGENT_PROMPT =
  "Deploy this Next.js app to Vercel. If it isn't on GitHub yet, push it, then " +
  "create a Vercel project from the repo. Set these environment variables in " +
  "Vercel from my .env.local: FLYNET_API_KEY, FLYNET_CLIENT_ID, " +
  "FLYNET_CLIENT_SECRET. Don't set REDIRECT_URI — the app derives it from " +
  "Vercel's production URL automatically. Once deployed, tell me the production " +
  "domain's /callback URL so I can get it whitelisted for my OAuth app.";

// The .env.local keys that have to follow the app to Vercel. REDIRECT_URI is
// intentionally absent — on Vercel the app derives it from the injected
// VERCEL_PROJECT_PRODUCTION_URL, so there's nothing to set (and no redeploy).
// The API_BASE_URL / AUTH_* vars are absent for the same reason as always: the
// app defaults to production Blackbird, so they're only needed to override to
// staging.
const DEPLOY_ENV_KEYS = [
  "FLYNET_API_KEY",
  "FLYNET_CLIENT_ID",
  "FLYNET_CLIENT_SECRET",
];

function DeployView() {
  return (
    <div className="space-y-6">
      <p className="text-xs leading-relaxed text-subtle">
        This starter is a standard Next.js app, so Vercel deploys it with zero
        build config. The work is moving your secrets across and pointing OAuth
        at the live domain.
      </p>

      {/* Easy path: let the agent drive the whole deploy. */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Let your agent do it
        </h3>
        <div className="flex items-start gap-2 rounded-xl border border-strong bg-surface-low px-3 py-2">
          <code className="flex-1 font-mono text-[11px] leading-relaxed text-foreground">
            {DEPLOY_AGENT_PROMPT}
          </code>
          <CopyIconButton text={DEPLOY_AGENT_PROMPT} label="Copy prompt" />
        </div>
      </div>

      {/* Manual path. */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Or do it by hand
        </h3>
        <ol className="space-y-3 text-xs leading-relaxed text-subtle">
          <li className="flex gap-3">
            <span className="font-mono text-primary-bright">1.</span>
            <span>
              Push the repo to GitHub (or run{" "}
              <code className="font-mono text-foreground">vercel</code> to deploy
              straight from the CLI).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-primary-bright">2.</span>
            <span>
              Import it at{" "}
              <a
                href="https://vercel.com/new"
                target="_blank"
                rel="noreferrer"
                className="text-primary-bright underline underline-offset-2"
              >
                vercel.com/new
              </a>
              . Next.js is auto-detected — no build settings to change.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-primary-bright">3.</span>
            <span>
              In Project Settings → Environment Variables, add the keys below
              with the values from your{" "}
              <code className="font-mono text-foreground">.env.local</code>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-primary-bright">4.</span>
            <span>
              No need to set{" "}
              <code className="font-mono text-foreground">REDIRECT_URI</code> —
              the app derives it from your Vercel production URL. Just whitelist{" "}
              <code className="font-mono text-foreground">
                https://&lt;your-app&gt;.vercel.app/callback
              </code>{" "}
              at{" "}
              <a
                href="https://make.flynet.org/"
                target="_blank"
                rel="noreferrer"
                className="text-primary-bright underline underline-offset-2"
              >
                make.flynet.org
              </a>{" "}
              (sign in with your Slack email). On a custom domain, set{" "}
              <code className="font-mono text-foreground">REDIRECT_URI</code> to
              that domain&apos;s <code className="font-mono text-foreground">/callback</code>{" "}
              instead.
            </span>
          </li>
        </ol>
      </div>

      {/* The env keys to recreate in Vercel. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Env vars to set
          </h3>
          <CopyIconButton
            text={DEPLOY_ENV_KEYS.join("\n")}
            label="Copy env keys"
          />
        </div>
        <div className="rounded-xl border border-strong bg-surface-low px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
          {DEPLOY_ENV_KEYS.map((k) => (
            <div key={k}>{k}</div>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-subtle">
          <code className="font-mono">ACCESS_TOKEN</code> is optional (pins a
          member token). You don&apos;t need{" "}
          <code className="font-mono">API_BASE_URL</code> /{" "}
          <code className="font-mono">AUTH_BASE_URL</code> /{" "}
          <code className="font-mono">AUTH_AUDIENCE</code> — the app already
          targets production Blackbird; set them only to point back at staging.
        </p>
      </div>

      {/* The one thing people forget — the redirect URI must match the live host
          and be whitelisted, or sign-in breaks in prod exactly like it would on
          localhost. */}
      <p className="rounded-lg border border-brand-yellow/30 bg-brand-yellow/10 px-3 py-2 text-xs leading-relaxed text-brand-yellow">
        Heads up: don&apos;t carry your local{" "}
        <code className="font-mono">REDIRECT_URI</code> (the ngrok/Codespace URL)
        over to Vercel — the app derives the right one from your production
        domain. The one thing you must do is whitelist your{" "}
        <code className="font-mono">https://&lt;your-app&gt;.vercel.app/callback</code>{" "}
        at{" "}
        <a
          href="https://make.flynet.org/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          make.flynet.org
        </a>{" "}
        or sign-in will fail.
      </p>
    </div>
  );
}

function NavCard({
  title,
  hint,
  onClick,
}: {
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-strong bg-surface-low/40 p-4 text-left transition hover:bg-surface-low"
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-subtle">{hint}</p>
      </div>
      <span className="shrink-0 text-muted">→</span>
    </button>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function Section({
  index,
  title,
  hint,
  done,
  action,
  children,
}: {
  index: number;
  title: string;
  hint: string;
  done?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-strong bg-surface-low/40 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            done
              ? "bg-success/15 text-success"
              : "bg-primary/15 text-primary-bright"
          }`}
        >
          {done ? "✓" : index}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-subtle">{hint}</p>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="h-10 animate-pulse rounded-xl bg-surface-low" aria-hidden />
  );
}

// Compact icon-only copy button — swaps to a check for a beat after copying.
function CopyIconButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (e.g. non-secure origin); text stays visible.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={label}
      aria-label={label}
      className="shrink-0 rounded-md p-1 text-muted transition hover:bg-surface hover:text-foreground"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-success" />
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
    </button>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
