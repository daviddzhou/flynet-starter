import { type ShareQuestSnapshot } from "./share";

const SHARE_TTL_MS = 1000 * 60 * 60 * 12;
const MAX_SHARE_SNAPSHOTS = 200;

type ShareRecord = {
  expiresAt: number;
  snapshot: ShareQuestSnapshot;
};

type ShareStoreGlobal = typeof globalThis & {
  __passportQuestShareStore?: Map<string, ShareRecord>;
};

export function storeShareSnapshot(snapshot: ShareQuestSnapshot): {
  expiresAt: string;
  id: string;
} {
  const store = getShareStore();
  purgeExpiredShareSnapshots(store);

  const expiresAt = Date.now() + SHARE_TTL_MS;
  const id = createShareId(snapshot, store);

  store.set(id, { expiresAt, snapshot });
  trimShareStore(store);

  return {
    expiresAt: new Date(expiresAt).toISOString(),
    id,
  };
}

export function getStoredShareSnapshot(id: string): ShareQuestSnapshot | null {
  if (!isSafeShareId(id)) return null;

  const store = getShareStore();
  const record = store.get(id);

  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }

  return record.snapshot;
}

function getShareStore(): Map<string, ShareRecord> {
  const globalForStore = globalThis as ShareStoreGlobal;
  globalForStore.__passportQuestShareStore ??= new Map<string, ShareRecord>();
  return globalForStore.__passportQuestShareStore;
}

function createShareId(
  snapshot: ShareQuestSnapshot,
  store: Map<string, ShareRecord>,
): string {
  const slug = snapshot.challengeId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  const base = `${slug}-${hashSnapshot(snapshot).slice(0, 5)}`;
  let id = base;
  let suffix = 2;

  while (store.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  return id;
}

function hashSnapshot(snapshot: ShareQuestSnapshot): string {
  const source = JSON.stringify({
    challengeId: snapshot.challengeId,
    completed: snapshot.completed,
    generatedAt: snapshot.generatedAt,
    stops: snapshot.stops.map((stop) => [stop.index, stop.name]),
  });
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function purgeExpiredShareSnapshots(store: Map<string, ShareRecord>) {
  const now = Date.now();

  store.forEach((record, id) => {
    if (record.expiresAt < now) store.delete(id);
  });
}

function trimShareStore(store: Map<string, ShareRecord>) {
  while (store.size > MAX_SHARE_SNAPSHOTS) {
    const oldest = store.keys().next().value;
    if (!oldest) return;
    store.delete(oldest);
  }
}

function isSafeShareId(id: string): boolean {
  return /^[a-z0-9-]{8,80}$/.test(id);
}
