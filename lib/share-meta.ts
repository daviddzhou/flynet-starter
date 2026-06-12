import type { ShareQuestSnapshot } from "./share";

const DEFAULT_SITE_URL = "https://passport-quest-flynet.vercel.app";
const MAX_TITLE_LENGTH = 74;
const MAX_DESCRIPTION_LENGTH = 182;
const MAX_IMAGE_PARAM_LENGTH = 96;

export function getShareSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;

  return DEFAULT_SITE_URL;
}

export function buildShareTitle(snapshot?: ShareQuestSnapshot | null): string {
  if (!snapshot) return "Passport Quest by Blackbird";

  return compactText(`${snapshot.title} | Passport Quest`, MAX_TITLE_LENGTH);
}

export function buildShareDescription(
  snapshot?: ShareQuestSnapshot | null,
): string {
  if (!snapshot) {
    return "Open a timed Blackbird restaurant quest with ordered stops, Google Maps directions, and a FLY reward preview.";
  }

  return compactText(
    `${snapshot.stopCount} stops, ${snapshot.windowLabel}. ${snapshot.routeSummary}. ${snapshot.rewardLabel}. Open the ordered restaurants and Google Maps route.`,
    MAX_DESCRIPTION_LENGTH,
  );
}

export function buildShareImagePath(
  snapshot?: ShareQuestSnapshot | null,
): string {
  const params = new URLSearchParams();

  params.set("title", imageParam(snapshot?.title ?? "Passport Quest"));
  params.set("track", imageParam(snapshot?.trackLabel ?? "Blackbird route"));
  params.set("stops", String(snapshot?.stopCount ?? 3));
  params.set("window", imageParam(snapshot?.windowLabel ?? "Tonight"));
  params.set(
    "route",
    imageParam(snapshot?.routeSummary ?? "Ordered restaurant route"),
  );
  params.set(
    "reward",
    imageParam(snapshot?.rewardLabel ?? "FLY reward preview"),
  );
  params.set("state", snapshot?.completed ? "unlocked" : "preview");
  params.set(
    "names",
    (snapshot?.stops ?? [])
      .slice(0, 7)
      .map((stop) => imageParam(stop.name, 28))
      .join("|"),
  );

  return `/share/image?${params.toString()}`;
}

export function buildShareImageUrl(
  snapshot?: ShareQuestSnapshot | null,
  origin = getShareSiteUrl(),
): string {
  return new URL(buildShareImagePath(snapshot), origin).toString();
}

export function compactText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function imageParam(text: string, maxLength = MAX_IMAGE_PARAM_LENGTH): string {
  return compactText(text, maxLength);
}
