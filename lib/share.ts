export type ShareQuestStop = {
  index: number;
  name: string;
  cuisines: string;
  locationLabel: string;
  addressLine: string | null;
  legLabel: string;
};

export type ShareQuestSnapshot = {
  title: string;
  trackLabel: string;
  challengeId: string;
  stopCount: number;
  windowLabel: string;
  cadenceLabel: string;
  routeSummary: string;
  rewardLabel: string;
  completed: boolean;
  directionsUrl: string | null;
  generatedAt: string;
  stops: ShareQuestStop[];
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeShareSnapshot(snapshot: ShareQuestSnapshot): string {
  const bytes = textEncoder.encode(JSON.stringify(snapshot));
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeShareSnapshot(encoded?: string | null): ShareQuestSnapshot | null {
  if (!encoded) {
    return null;
  }

  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(textDecoder.decode(bytes));

    if (!isShareSnapshot(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function isShareSnapshot(value: unknown): value is ShareQuestSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.title === "string" &&
    typeof value.trackLabel === "string" &&
    typeof value.challengeId === "string" &&
    typeof value.stopCount === "number" &&
    typeof value.windowLabel === "string" &&
    typeof value.cadenceLabel === "string" &&
    typeof value.routeSummary === "string" &&
    typeof value.rewardLabel === "string" &&
    typeof value.completed === "boolean" &&
    (value.directionsUrl === null || typeof value.directionsUrl === "string") &&
    typeof value.generatedAt === "string" &&
    Array.isArray(value.stops) &&
    value.stops.every(isShareQuestStop)
  );
}

function isShareQuestStop(value: unknown): value is ShareQuestStop {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.index === "number" &&
    typeof value.name === "string" &&
    typeof value.cuisines === "string" &&
    typeof value.locationLabel === "string" &&
    (value.addressLine === null || typeof value.addressLine === "string") &&
    typeof value.legLabel === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
