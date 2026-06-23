"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FlynetMemberClient } from "@flynetdev/core";
import {
  FlynetProvider,
  WalletBadge,
  profileQueryKey,
  useFlynetMember,
  walletsQueryKey,
} from "@flynetdev/react";
import { BBPayButton, UserCard } from "../components";

// One QueryClient for the whole member section (profile + the SDK's own wallet
// queries). The defaults keep API traffic lean: data stays "fresh" for a minute
// so remounts reuse the cache, and we don't refetch every time the tab regains
// focus. After a payment we still invalidate the wallet key explicitly to pull
// the new balance — refetch on the event that changed it, not on a timer.
const memberQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Member components run in the browser and read from the FlynetProvider. The
// member client holds the OAuth token and fetches client-side, so this is a
// Client Component. The token is passed down from the server (page.tsx).
export function MemberPanel({ accessToken }: { accessToken: string }) {
  const member = useMemo(
    () =>
      new FlynetMemberClient({
        accessToken,
        // The Blackbird edge blocks cross-origin browser requests (CORS), so
        // route them through the same-origin proxy defined in next.config.mjs.
        // The SDK requires an absolute URL; window is always defined by fetch
        // time.
        ...(typeof window !== "undefined"
          ? { serverURL: `${window.location.origin}/flynet-proxy` }
          : {}),
      }),
    [accessToken],
  );

  return (
    <FlynetProvider member={member} queryClient={memberQueryClient}>
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-muted">
          Your Blackbird account
        </h2>
        <MemberProfile />
        <WalletBadge display="fly-and-usd" />
        <ClaimRewardSection />
        <PaySection />
      </section>
    </FlynetProvider>
  );
}

// Demo charge: 1 FLY (wei is a stringified integer, 18 decimals). The USD
// label is display-only — the v1 API is FLY-denominated, with ~1 FLY ≈ $0.10.
const DEMO_AMOUNT_FLY_WEI = "1000000000000000000";
const DEMO_AMOUNT_USD_CENTS = 10;

// Blackbird Pay as proper steps: click → confirm → receipt.
//
// POST /api/pay creates AND confirms a Payment Intent server-side, on whichever
// member token the server resolves fresh at call time — env pin, OAuth cookie
// (auto-renewed by middleware), or the local session file kept alive by the
// refresh watcher. Because the token is resolved server-side per request, the
// charge always runs on a live token even if this page has been open for a
// while. We gate the actual call behind an explicit confirm step, then show a
// receipt. Lives inside the provider so a successful payment can refresh the
// wallet badge.

type Receipt = {
  id: string;
  status?: string;
  paidAt?: string;
};

type PayState =
  | { phase: "idle" }
  | { phase: "confirm" }
  | { phase: "paying" }
  | { phase: "paid"; receipt: Receipt }
  | { phase: "error"; message: string };

function PaySection() {
  const queryClient = useQueryClient();
  const [pay, setPay] = useState<PayState>({ phase: "idle" });

  async function confirmAndPay() {
    setPay({ phase: "paying" });
    try {
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountFlyWei: DEMO_AMOUNT_FLY_WEI,
          description: "Flynet starter demo payment",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Payment failed (HTTP ${res.status}).`);
      }
      setPay({
        phase: "paid",
        receipt: { id: data.id, status: data.status, paidAt: data.paidAt },
      });
      // The balance changed upstream; refetch the wallet badge.
      queryClient.invalidateQueries({ queryKey: walletsQueryKey });
    } catch (error) {
      setPay({
        phase: "error",
        message: error instanceof Error ? error.message : "Payment failed.",
      });
    }
  }

  // Step 3 — receipt.
  if (pay.phase === "paid") {
    return (
      <PaymentReceipt
        receipt={pay.receipt}
        onDone={() => setPay({ phase: "idle" })}
      />
    );
  }

  // Step 2 — confirm before sending.
  if (pay.phase === "confirm") {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Confirm payment</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Send <span className="font-semibold text-foreground">1 FLY</span>{" "}
            (≈ $0.10) to the starter merchant? It&apos;s created and confirmed
            server-side, and it&apos;s irreversible.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirmAndPay}
            className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition duration-150 hover:opacity-90 active:bg-primary-dim"
          >
            Confirm &amp; pay
          </button>
          <button
            type="button"
            onClick={() => setPay({ phase: "idle" })}
            className="inline-flex h-10 items-center rounded-full border border-white/10 px-5 text-sm font-medium text-muted transition duration-150 hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Step 1 — the entry button (idle), plus the in-flight / error states.
  return (
    <div className="space-y-2 pt-2">
      <BBPayButton
        amountUsdCents={DEMO_AMOUNT_USD_CENTS}
        onPay={() => setPay({ phase: "confirm" })}
        disabled={pay.phase === "paying"}
      />
      {pay.phase === "paying" ? (
        <p className="text-xs text-subtle">Processing payment…</p>
      ) : pay.phase === "error" ? (
        <p className="text-xs text-failure">{pay.message}</p>
      ) : (
        <p className="text-xs text-subtle">
          Demo payment — 1 FLY to the starter merchant. You&apos;ll confirm
          before it sends.
        </p>
      )}
    </div>
  );
}

// The receipt shown after a confirmed payment — amount, status, time, and the
// Payment Intent id, with a reset back to the pay button.
function PaymentReceipt({
  receipt,
  onDone,
}: {
  receipt: Receipt;
  onDone: () => void;
}) {
  const paidAt = receipt.paidAt ? new Date(receipt.paidAt) : null;
  return (
    <div className="space-y-3 rounded-2xl border border-success/30 bg-success/5 p-4">
      <div className="flex items-center gap-2">
        <CheckCircleIcon className="h-4 w-4 shrink-0 text-success" />
        <p className="text-sm font-medium text-foreground">Payment complete</p>
      </div>
      <dl className="space-y-1.5 text-xs">
        <ReceiptRow label="Amount">
          1 FLY <span className="text-muted">(≈ $0.10)</span>
        </ReceiptRow>
        {receipt.status ? (
          <ReceiptRow label="Status">{receipt.status}</ReceiptRow>
        ) : null}
        {paidAt ? (
          <ReceiptRow label="Paid">{paidAt.toLocaleString()}</ReceiptRow>
        ) : null}
        <ReceiptRow label="Intent">
          <code className="rounded bg-white/10 px-1 py-0.5 text-foreground">
            {receipt.id}
          </code>
        </ReceiptRow>
      </dl>
      <button
        type="button"
        onClick={onDone}
        className="inline-flex h-10 items-center rounded-full border border-white/10 px-5 text-sm font-medium text-muted transition duration-150 hover:text-foreground"
      >
        New payment
      </button>
    </div>
  );
}

function ReceiptRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

function CheckCircleIcon({ className = "" }: { className?: string }) {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

// Claim a 1 FLY reward, credited to the signed-in member from the app's own
// wallet. The whole flow runs server-side (/api/reward) under the Discovery API
// key — the browser never sees it. Lives inside the provider so a successful
// claim can invalidate the wallet query and refresh the badge above.
type RewardStatus = {
  merchantId: string | null;
  balanceWei: string | null;
  balanceUsdCents: number | null;
  canClaim: boolean;
};

function ClaimRewardSection() {
  const queryClient = useQueryClient();
  const [claim, setClaim] = useState<{
    phase: "idle" | "claiming" | "claimed" | "error";
    message?: string;
    insufficient?: boolean;
  }>({ phase: "idle" });

  // App-wallet status: does it hold enough FLY to cover a claim, and the
  // merchant id to hand out for a top-up. Cached like the rest of the panel.
  const { data: status } = useQuery<RewardStatus>({
    queryKey: ["app-reward-status"],
    queryFn: async () => {
      const res = await fetch("/api/reward");
      if (!res.ok) throw new Error("status");
      return res.json();
    },
  });

  async function handleClaim() {
    setClaim({ phase: "claiming" });
    try {
      const res = await fetch("/api/reward", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        // Coerce to a string — never let an error object reach the JSX, or
        // React throws "Objects are not valid as a React child".
        const message =
          typeof data.error === "string"
            ? data.error
            : `Claim failed (HTTP ${res.status}).`;
        setClaim({
          phase: "error",
          message,
          insufficient: Boolean(data.insufficient),
        });
        return;
      }
      setClaim({
        phase: "claimed",
        message: data.alreadyClaimed
          ? "Already claimed — 1 FLY is in your wallet."
          : "Claimed! 1 FLY added to your wallet.",
      });
      // The member's balance changed upstream; refetch the wallet badge, and
      // the app-wallet status (its balance just dropped by 1 FLY).
      queryClient.invalidateQueries({ queryKey: walletsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["app-reward-status"] });
    } catch {
      setClaim({ phase: "error", message: "Couldn't reach the rewards API." });
    }
  }

  // App wallet is short on FLY (known up front, or surfaced by a failed claim):
  // point the developer at the top-up path instead of a dead button.
  const walletEmpty = status?.canClaim === false || claim.insufficient;
  if (walletEmpty) {
    return (
      <div className="space-y-2 rounded-2xl border border-white/10 p-4 text-sm">
        <p className="font-medium text-foreground">Claim 1 FLY</p>
        <p className="text-xs leading-relaxed text-muted">
          The app wallet is out of FLY, so there&apos;s nothing to reward with
          yet. To get it funded for testing, send this Flynet merchant id to the
          Flynet team:
        </p>
        {status?.merchantId ? (
          <code className="block break-all rounded bg-white/10 px-2 py-1 text-xs text-foreground">
            {status.merchantId}
          </code>
        ) : (
          <p className="text-xs text-subtle">
            (merchant id unavailable — check the key&apos;s <code>read:app</code>{" "}
            scope.)
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      <button
        type="button"
        onClick={handleClaim}
        disabled={claim.phase === "claiming" || claim.phase === "claimed"}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition duration-150 hover:opacity-90 active:bg-primary-dim disabled:opacity-50"
      >
        ✦ Claim 1 FLY
      </button>
      {claim.phase === "claiming" ? (
        <p className="text-xs text-subtle">Issuing reward…</p>
      ) : null}
      {claim.phase === "claimed" ? (
        <p className="text-xs text-success">{claim.message}</p>
      ) : null}
      {claim.phase === "error" ? (
        <p className="text-xs text-failure">{claim.message}</p>
      ) : null}
      {claim.phase === "idle" ? (
        <p className="text-xs text-subtle">
          A free 1 FLY welcome reward, credited to your wallet from the app
          wallet — instant and irreversible.
        </p>
      ) : null}
    </div>
  );
}

// Lives inside the provider so the hook can reach the member client. Fetches
// only the profile (`GET /users/me`) — the SDK's usePassport also fetches
// /users/me/status and fails the whole card when either call fails, and the
// card only renders profile fields anyway.
function MemberProfile() {
  const member = useFlynetMember();
  const { data, isPending, error } = useQuery({
    queryKey: profileQueryKey,
    queryFn: () => member.getProfile(),
  });

  if (isPending) {
    return (
      <div className="h-20 animate-pulse rounded-2xl bg-surface-low" aria-hidden />
    );
  }
  if (error || !data) {
    return (
      <p className="rounded-2xl border border-failure/40 p-4 text-sm text-failure">
        We couldn&apos;t load your profile.
      </p>
    );
  }
  return <UserCard user={data} />;
}
