import type { Restaurant } from "@flynetdev/react";
import type { RestaurantLocation } from "./locations";

export interface TasteProfile {
  id: string;
  displayName: string;
  label: string;
  preferredCuisines: string[];
  notes: string;
}

export interface QuestRestaurantInput {
  restaurant: Restaurant;
  locations: RestaurantLocation[];
  checkInCount: number | null;
}

export interface QuestStop {
  order: number;
  restaurantId: string;
  name: string;
  cuisines: string[];
  price: number | null;
  imageUrl: string | null;
  websiteUrl: string | null;
  checkInCount: number | null;
  location: {
    id: string;
    label: string;
    addressLine: string | null;
    reservationUrl: string | null;
  } | null;
  coordinate: {
    latitude: number;
    longitude: number;
  } | null;
  matchReason: string;
  score: number;
}

export interface Quest {
  title: string;
  durationLabel: string;
  routeSummary: string;
  rewardPreview: string;
  seed: string;
  tasteProfile: TasteProfile;
  stops: QuestStop[];
  candidateCount: number;
  coordinateCount: number;
}

type ScoredCandidate = Omit<QuestStop, "order"> & {
  matchedCuisines: string[];
  baseScore: number;
};

export const DEFAULT_TASTE_PROFILE: TasteProfile = {
  id: "guest-profile",
  displayName: "Guest",
  label: "Open preferences",
  preferredCuisines: [],
  notes:
    "A local preference profile used when the diner continues without OAuth.",
};

const QUEST_SIZE = 5;
const MAX_STOPS = 75;

export function buildPassportQuest(
  inputs: QuestRestaurantInput[],
  tasteProfile: TasteProfile = DEFAULT_TASTE_PROFILE,
): Quest {
  const candidates = inputs
    .filter(({ restaurant }) => restaurant.name.trim().length > 0)
    .map((input) => scoreCandidate(input, tasteProfile))
    .sort((a, b) => b.baseScore - a.baseScore);

  const stops = orderRoute(selectCompactSet(candidates, MAX_STOPS)).map(
    (candidate, index) => ({
      ...candidate,
      order: index + 1,
    }),
  );

  return {
    title: "Build a passport route",
    durationLabel: "Tonight",
    routeSummary: summarizeRoute(stops.slice(0, QUEST_SIZE)),
    rewardPreview: "Simulated 50 FLY unlock after the final check-in",
    seed: buildQuestSeed(stops),
    tasteProfile,
    stops,
    candidateCount: candidates.length,
    coordinateCount: stops.filter((stop) => stop.coordinate).length,
  };
}

export function prioritizeRestaurantsForTaste(
  restaurants: Restaurant[],
  tasteProfile: TasteProfile = DEFAULT_TASTE_PROFILE,
): Restaurant[] {
  return [...restaurants].sort((a, b) => {
    const aMatches = matchCuisines(a.cuisine, tasteProfile.preferredCuisines);
    const bMatches = matchCuisines(b.cuisine, tasteProfile.preferredCuisines);
    return (
      bMatches.length - aMatches.length ||
      Number(Boolean(b.asset)) - Number(Boolean(a.asset)) ||
      b.cuisine.length - a.cuisine.length ||
      deterministicJitter(b.id, 100) - deterministicJitter(a.id, 100)
    );
  });
}

function scoreCandidate(
  { restaurant, locations, checkInCount }: QuestRestaurantInput,
  tasteProfile: TasteProfile,
): ScoredCandidate {
  const location = chooseLocation(locations);
  const matchedCuisines = matchCuisines(
    restaurant.cuisine,
    tasteProfile.preferredCuisines,
  );
  const tasteScore =
    matchedCuisines.length > 0 ? 120 + matchedCuisines.length * 24 : 0;
  const socialScore =
    typeof checkInCount === "number" && checkInCount > 0
      ? Math.min(62, Math.log10(checkInCount + 1) * 24)
      : 0;
  const mapScore = location?.coordinate ? 22 : 0;
  const bookingScore = location?.reservationUrl ? 10 : 0;
  const randomScore = deterministicJitter(restaurant.id, 18);
  const baseScore =
    tasteScore + socialScore + mapScore + bookingScore + randomScore;

  return {
    restaurantId: restaurant.id,
    name: restaurant.name,
    cuisines: restaurant.cuisine.slice(0, 4),
    price: typeof restaurant.price === "number" ? restaurant.price : null,
    imageUrl:
      restaurant.asset?.web2x ??
      restaurant.asset?.full3x ??
      restaurant.asset?.preview1x ??
      null,
    websiteUrl: restaurant.websiteUrl ?? null,
    checkInCount,
    location: location
      ? {
          id: location.id,
          label: locationLabel(location),
          addressLine: location.addressLine,
          reservationUrl: location.reservationUrl,
        }
      : null,
    coordinate: location?.coordinate ?? null,
    matchReason: buildMatchReason(matchedCuisines, checkInCount),
    matchedCuisines,
    baseScore,
    score: Math.round(baseScore),
  };
}

function selectCompactSet(
  candidates: ScoredCandidate[],
  count: number,
): ScoredCandidate[] {
  if (candidates.length <= count) return candidates;
  const anchor = candidates.find((candidate) => candidate.coordinate) ?? candidates[0];
  return candidates
    .map((candidate) => ({
      candidate,
      routeScore:
        candidate.baseScore + compactnessBonus(anchor.coordinate, candidate.coordinate),
    }))
    .sort((a, b) => b.routeScore - a.routeScore)
    .slice(0, count)
    .map(({ candidate, routeScore }) => ({
      ...candidate,
      score: Math.round(routeScore),
    }));
}

function orderRoute(candidates: ScoredCandidate[]): ScoredCandidate[] {
  if (candidates.length <= 1) return candidates;
  const withCoordinates = candidates.filter((candidate) => candidate.coordinate);
  if (withCoordinates.length < 2) return candidates;

  const remaining = [...candidates];
  const route: ScoredCandidate[] = [];
  let current: ScoredCandidate | undefined =
    remaining
      .filter((candidate) => candidate.coordinate)
      .sort((a, b) => {
        const aCoordinate = a.coordinate;
        const bCoordinate = b.coordinate;
        if (!aCoordinate || !bCoordinate) return 0;
        return (
          aCoordinate.longitude - bCoordinate.longitude ||
          aCoordinate.latitude - bCoordinate.latitude
        );
      })[0] ?? remaining[0];

  while (current) {
    route.push(current);
    remaining.splice(remaining.indexOf(current), 1);
    current = nearestCandidate(current, remaining);
  }

  return route;
}

function nearestCandidate(
  current: ScoredCandidate,
  candidates: ScoredCandidate[],
): ScoredCandidate | undefined {
  if (!current.coordinate) return candidates[0];
  return candidates
    .map((candidate) => ({
      candidate,
      distance:
        candidate.coordinate && current.coordinate
          ? distanceKm(current.coordinate, candidate.coordinate)
          : Number.POSITIVE_INFINITY,
    }))
    .sort(
      (a, b) => a.distance - b.distance || b.candidate.baseScore - a.candidate.baseScore,
    )[0]?.candidate;
}

function chooseLocation(
  locations: RestaurantLocation[],
): RestaurantLocation | null {
  return (
    locations.find((location) => location.coordinate) ??
    locations.find((location) => location.neighborhood || location.city) ??
    locations[0] ??
    null
  );
}

function matchCuisines(cuisines: string[], preferredCuisines: string[]): string[] {
  const preferred = preferredCuisines.map(normalize);
  return cuisines.filter((cuisine) => {
    const normalizedCuisine = normalize(cuisine);
    return preferred.some(
      (preferredCuisine) =>
        normalizedCuisine.includes(preferredCuisine) ||
        preferredCuisine.includes(normalizedCuisine),
    );
  });
}

function buildMatchReason(
  matchedCuisines: string[],
  checkInCount: number | null,
): string {
  if (matchedCuisines.length > 0) {
    return `Matches preferences on ${matchedCuisines.slice(0, 2).join(" and ")}`;
  }
  if (typeof checkInCount === "number" && checkInCount > 0) {
    return `${checkInCount.toLocaleString("en-US")} Blackbird check-ins`;
  }
  return "High-signal Flynet discovery pick";
}

function locationLabel(location: RestaurantLocation): string {
  return (
    [location.neighborhood, location.city].filter(Boolean).join(" / ") ||
    location.addressLine ||
    "Flynet location"
  );
}

function summarizeRoute(stops: Array<Pick<QuestStop, "location">>): string {
  const labels = stops
    .map((stop) => stop.location?.label)
    .filter((label): label is string => Boolean(label));
  if (labels.length >= 2) return labels.slice(0, 5).join(" to ");
  if (labels.length === 1) return `${labels[0]} and nearby picks`;
  return "Flynet restaurants ranked by preferences and proximity";
}

function buildQuestSeed(stops: QuestStop[]): string {
  const seed = stops.map((stop) => stop.restaurantId.slice(0, 4)).join("-");
  return seed || "passport-quest";
}

function compactnessBonus(
  anchor: QuestStop["coordinate"],
  coordinate: QuestStop["coordinate"],
): number {
  if (!anchor || !coordinate) return 0;
  const distance = distanceKm(anchor, coordinate);
  return Math.max(0, 40 - distance * 5);
}

function distanceKm(
  a: NonNullable<QuestStop["coordinate"]>,
  b: NonNullable<QuestStop["coordinate"]>,
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function deterministicJitter(id: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % max;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
