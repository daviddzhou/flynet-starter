"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { BirdMark } from "../../components/bird-mark";
import {
  decodeShareSnapshot,
  isShareSnapshot,
  type ShareQuestSnapshot,
} from "../../lib/share";
import {
  buildShareDescription,
  buildShareImagePath,
  buildShareTitle,
} from "../../lib/share-meta";

type SharePageClientProps = {
  encoded: string | null;
  id: string | null;
  initialSnapshot: ShareQuestSnapshot | null;
};

export function SharePageClient({
  encoded,
  id,
  initialSnapshot,
}: SharePageClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(Boolean(id && !initialSnapshot));

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      if (!id) {
        setSnapshot(initialSnapshot ?? decodeShareSnapshot(encoded));
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(`/api/share?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });

        if (!response.ok) throw new Error("Share not found");

        const payload = (await response.json()) as { snapshot?: unknown };
        if (!isShareSnapshot(payload.snapshot)) {
          throw new Error("Invalid share snapshot");
        }

        if (!cancelled) setSnapshot(payload.snapshot);
      } catch {
        if (!cancelled) {
          setSnapshot(initialSnapshot ?? decodeShareSnapshot(encoded));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [encoded, id, initialSnapshot]);

  if (loading) {
    return (
      <ShareStatePage
        body="Pulling the ordered itinerary and route details."
        title="Loading this quest"
      />
    );
  }

  if (!snapshot) {
    return (
      <ShareStatePage
        action={
          <Link className={secondaryButtonClassName} href="/">
            Build a quest
          </Link>
        }
        body="Build a fresh quest to generate a new itinerary link."
        title="This share link expired"
      />
    );
  }

  return <ShareItinerary snapshot={snapshot} />;
}

function ShareItinerary({ snapshot }: { snapshot: ShareQuestSnapshot }) {
  const shareDescription = buildShareDescription(snapshot);
  const shareImageHref = buildShareImagePath(snapshot);
  const shareTitle = buildShareTitle(snapshot);
  const [imageStatus, setImageStatus] = useState("Share image ready");
  const generatedDate = new Date(snapshot.generatedAt);
  const generatedAt = Number.isNaN(generatedDate.getTime())
    ? "recently"
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(generatedDate);

  async function copyShareImageLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(shareImageHref, window.location.href).toString(),
      );
      setImageStatus("Copied image link");
    } catch {
      setImageStatus("Open image link ready");
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background-darker text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgb(var(--surface-bg-darker))_0%,rgb(var(--surface-bg))_52%,rgb(var(--surface-container-low))_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-surface-low shadow-[0_24px_80px_rgb(0_0_0/0.45)]">
          <header className="border-b border-white/10 bg-surface p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <TagPill tone="dark">Passport Quest</TagPill>
              <TagPill tone="purple">{snapshot.trackLabel}</TagPill>
              <TagPill tone={snapshot.completed ? "success" : "yellow"}>
                {snapshot.completed ? "Reward unlocked" : "Reward preview"}
              </TagPill>
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <div>
                <p className="text-sm font-semibold text-primary-bright">
                  {snapshot.stopCount} stops, {snapshot.windowLabel}
                </p>
                <h1 className="mt-3 max-w-3xl text-balance text-4xl font-black leading-[0.94] tracking-tight text-foreground sm:text-6xl">
                  {snapshot.title}
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-muted sm:text-base">
                  {snapshot.routeSummary}
                </p>
              </div>

              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <p className="text-xs font-bold text-primary-bright">Challenge</p>
                <p className="mt-1 break-all text-lg font-black text-foreground">
                  {snapshot.challengeId}
                </p>
                <p className="mt-3 text-xs font-semibold text-muted">
                  Generated {generatedAt}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {snapshot.directionsUrl ? (
                <a
                  className={primaryButtonClassName}
                  href={snapshot.directionsUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open Google Maps route
                </a>
              ) : null}
              <Link className={secondaryButtonClassName} href="/">
                Build another quest
              </Link>
            </div>
          </header>

          <section className="grid gap-3 p-5 sm:p-6 md:grid-cols-3">
            <Metric label="Cadence" value={snapshot.cadenceLabel} />
            <Metric label="Reward" tone="success" value={snapshot.rewardLabel} />
            <Metric
              label="Route"
              value={snapshot.routeSummary.split(",")[0] ?? "Mapped"}
            />
          </section>

          <section className="px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="rounded-3xl border border-white/10 bg-background-darker p-4 sm:p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-primary-bright">
                    Route order
                  </p>
                  <h2 className="mt-1 text-xl font-black text-foreground">
                    Ordered itinerary
                  </h2>
                </div>
                <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-bold text-success">
                  {snapshot.stopCount} stops
                </span>
              </div>

              <ol className="relative space-y-3 before:absolute before:bottom-8 before:left-[1.35rem] before:top-8 before:w-px before:bg-primary/45">
                {snapshot.stops.map((stop) => (
                  <li
                    className="relative grid grid-cols-[2.75rem_1fr] gap-3 rounded-2xl border border-white/10 bg-surface-low p-3 transition hover:border-primary/40"
                    key={`${stop.index}-${stop.name}`}
                  >
                    <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border border-primary-bright/50 bg-primary text-base font-black text-primary-foreground shadow-[0_0_0_6px_rgb(var(--surface-container-low))]">
                      {stop.index}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-lg font-black leading-tight text-foreground">
                          {stop.name}
                        </h3>
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary-bright">
                          {stop.legLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-muted">
                        {stop.cuisines}
                      </p>
                      <p className="mt-2 text-sm leading-5 text-subtle">
                        {stop.addressLine ?? stop.locationLabel}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </section>

        <aside className="rounded-3xl border border-white/10 bg-surface-low p-5 shadow-[0_24px_80px_rgb(0_0_0/0.35)] lg:sticky lg:top-6">
          <div className="flex h-12 w-14 items-center justify-center rounded-2xl border border-white/10 bg-background-darker text-foreground">
            <BirdMark size={32} />
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-tight text-foreground">
            Quest pass
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {shareDescription}
          </p>

          <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/10 p-4">
            <p className="text-xs font-bold text-primary-bright">Share title</p>
            <p className="mt-1 text-base font-black leading-tight text-foreground">
              {shareTitle}
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4">
            <p className="text-xs font-bold text-success">Rewards status</p>
            <p className="mt-1 text-lg font-black text-foreground">
              {snapshot.rewardLabel}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Preview only until a merchant issues the reward.
            </p>
          </div>

          <div className="mt-5 grid gap-2">
            {snapshot.directionsUrl ? (
              <a
                className={primaryButtonClassName}
                href={snapshot.directionsUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open route
              </a>
            ) : null}
            <Link className={secondaryButtonClassName} href="/">
              Build your own
            </Link>
            <a
              className={secondaryButtonClassName}
              href={shareImageHref}
              rel="noreferrer"
              target="_blank"
            >
              Open share image
            </a>
            <button
              className={secondaryButtonClassName}
              onClick={copyShareImageLink}
              type="button"
            >
              Copy image link
            </button>
          </div>
          <p className="mt-2 text-[11px] font-medium text-subtle">
            {imageStatus}
          </p>
        </aside>
      </div>
    </main>
  );
}

function Metric({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "success";
  value: string;
}) {
  return (
    <div
      className={
        tone === "success"
          ? "rounded-2xl border border-success/25 bg-success/10 px-4 py-3"
          : "rounded-2xl border border-white/10 bg-background-darker px-4 py-3"
      }
    >
      <div
        className={
          tone === "success"
            ? "text-xs font-bold text-success"
            : "text-xs font-bold text-primary-bright"
        }
      >
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-foreground">{value}</div>
    </div>
  );
}

function TagPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "dark" | "purple" | "success" | "yellow";
}) {
  const toneClassName =
    tone === "dark"
      ? "border-white/10 bg-background-darker text-foreground"
      : tone === "purple"
        ? "border-primary/30 bg-primary/15 text-primary-bright"
        : tone === "success"
          ? "border-success/30 bg-success/10 text-success"
          : "border-brand-yellow/35 bg-brand-yellow/10 text-brand-yellow";

  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-3 text-[11px] font-black ${toneClassName}`}
    >
      {children}
    </span>
  );
}

function ShareStatePage({
  action,
  body,
  title,
}: {
  action?: ReactNode;
  body: string;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background-darker px-4 py-8 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-surface-low p-6 text-center shadow-[0_24px_80px_rgb(0_0_0/0.45)]">
        <span className="mx-auto inline-flex rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[11px] font-black text-primary-bright">
          Passport Quest
        </span>
        <h1 className="mt-4 text-3xl font-black leading-none tracking-tight">
          {title}
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          {body}
        </p>
        {action ? (
          <div className="mt-5 flex justify-center">{action}</div>
        ) : null}
      </section>
    </main>
  );
}

const primaryButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-full bg-brand-yellow px-5 text-sm font-black text-background-darker shadow-[0_14px_34px_rgb(var(--brand-yellow)/0.18)] transition hover:translate-y-[-1px] hover:opacity-95";

const secondaryButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-full border border-white/14 bg-surface px-5 text-sm font-black text-foreground transition hover:border-primary/60 hover:bg-primary/10";
