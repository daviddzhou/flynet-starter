import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { FlynetDiscoveryClient } from "@flynetdev/core";
import type { Restaurant } from "@flynetdev/react";

import { env } from "./env";
import { listRestaurantLocations, type RestaurantLocation } from "./locations";
import {
  prioritizeRestaurantsForTaste,
  type QuestRestaurantInput,
} from "./quest";

const CACHE_SCHEMA_VERSION = 1;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DISCOVERY_PAGE_SIZE = 100;
const QUEST_RESTAURANT_LIMIT = 75;
const CACHE_PATH = path.join(process.cwd(), ".cache", "flynet-discovery.json");

type DiscoveryCacheFile = {
  schemaVersion: number;
  cachedAt: string;
  serverURL: string | null;
  pageSize: number;
  restaurantLimit: number;
  restaurants: Restaurant[];
  locationsByRestaurantId: Record<string, RestaurantLocation[]>;
};

let memoryCache: DiscoveryCacheFile | null = null;
let inFlightRefresh: Promise<DiscoveryCacheFile> | null = null;

export async function getCachedQuestRestaurantInputs(
  apiKey: string,
): Promise<QuestRestaurantInput[]> {
  const cached = await readCacheFile();

  if (cached && isFreshCache(cached)) {
    return cacheToQuestInputs(cached);
  }

  try {
    const fresh = await refreshCache(apiKey);
    return cacheToQuestInputs(fresh);
  } catch (error) {
    if (cached && cached.restaurants.length > 0) {
      return cacheToQuestInputs(cached);
    }
    throw error;
  }
}

export function getDiscoveryCachePath(): string {
  return CACHE_PATH;
}

async function refreshCache(apiKey: string): Promise<DiscoveryCacheFile> {
  if (!inFlightRefresh) {
    inFlightRefresh = fetchDiscoveryCache(apiKey).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function fetchDiscoveryCache(apiKey: string): Promise<DiscoveryCacheFile> {
  const discovery = new FlynetDiscoveryClient({
    apiKey,
    serverURL: env.API_BASE_URL,
  });
  const listed = await discovery.restaurants.listRestaurants({
    pageSize: DISCOVERY_PAGE_SIZE,
  });
  const restaurants = prioritizeRestaurantsForTaste(
    (listed.restaurants as Restaurant[]).filter((restaurant) => restaurant.name),
  ).slice(0, QUEST_RESTAURANT_LIMIT);

  const locations = await Promise.all(
    restaurants.map((restaurant) =>
      listRestaurantLocations(apiKey, restaurant.id).catch(() => []),
    ),
  );
  const locationsByRestaurantId = Object.fromEntries(
    restaurants.map((restaurant, index) => [
      restaurant.id,
      locations[index] ?? [],
    ]),
  );
  const cache: DiscoveryCacheFile = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    cachedAt: new Date().toISOString(),
    serverURL: env.API_BASE_URL ?? null,
    pageSize: DISCOVERY_PAGE_SIZE,
    restaurantLimit: QUEST_RESTAURANT_LIMIT,
    restaurants,
    locationsByRestaurantId,
  };

  await writeCacheFile(cache);
  return cache;
}

async function readCacheFile(): Promise<DiscoveryCacheFile | null> {
  if (memoryCache) {
    return memoryCache;
  }

  try {
    const raw = await readFile(CACHE_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isDiscoveryCacheFile(parsed)) {
      return null;
    }
    memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCacheFile(cache: DiscoveryCacheFile): Promise<void> {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
  memoryCache = cache;
}

function cacheToQuestInputs(cache: DiscoveryCacheFile): QuestRestaurantInput[] {
  return cache.restaurants.map((restaurant) => ({
    restaurant,
    locations: cache.locationsByRestaurantId[restaurant.id] ?? [],
    checkInCount: null,
  }));
}

function isFreshCache(cache: DiscoveryCacheFile): boolean {
  if (cache.schemaVersion !== CACHE_SCHEMA_VERSION) return false;
  if (cache.serverURL !== (env.API_BASE_URL ?? null)) return false;
  if (cache.pageSize !== DISCOVERY_PAGE_SIZE) return false;
  if (cache.restaurantLimit !== QUEST_RESTAURANT_LIMIT) return false;

  const cachedAt = new Date(cache.cachedAt).getTime();
  return Number.isFinite(cachedAt) && Date.now() - cachedAt < CACHE_TTL_MS;
}

function isDiscoveryCacheFile(value: unknown): value is DiscoveryCacheFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const maybe = value as Partial<DiscoveryCacheFile>;
  return (
    typeof maybe.schemaVersion === "number" &&
    typeof maybe.cachedAt === "string" &&
    (maybe.serverURL === null || typeof maybe.serverURL === "string") &&
    typeof maybe.pageSize === "number" &&
    typeof maybe.restaurantLimit === "number" &&
    Array.isArray(maybe.restaurants) &&
    Boolean(maybe.locationsByRestaurantId) &&
    typeof maybe.locationsByRestaurantId === "object" &&
    !Array.isArray(maybe.locationsByRestaurantId)
  );
}
