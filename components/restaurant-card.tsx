import type { Restaurant } from "@flynetdev/react";
import type { RestaurantLocation } from "../lib/locations";
import type { RestaurantSpecial } from "../lib/specials";
import type { RestaurantChallenge } from "../lib/challenges";
import { Tag } from "./tag";

// "Williamsburg · Brooklyn", with "+N more" when the restaurant has several
// locations. Neighborhood first — that's how diners think of a spot.
function locationLine(locations: RestaurantLocation[]): string | null {
  const [first] = locations;
  if (!first) return null;
  const place = [first.neighborhood, first.city].filter(Boolean).join(" · ");
  if (!place) return null;
  const more = locations.length - 1;
  return more > 0 ? `${place} +${more} more` : place;
}

// One restaurant from Flynet Discovery. Server-safe — render it straight from
// the listRestaurants response. Pass `locations` (lib/locations.ts) to show
// where it is and its booking link, `checkInCount` (lib/check-ins.ts) for the
// check-in stat, `specials` (lib/specials.ts) to surface active offers, and
// `challenges` (lib/challenges.ts) for active reward challenges.
export function RestaurantCard({
  restaurant,
  locations = [],
  checkInCount = null,
  specials = [],
  challenges = [],
}: {
  restaurant: Restaurant;
  locations?: RestaurantLocation[];
  checkInCount?: number | null;
  specials?: RestaurantSpecial[];
  challenges?: RestaurantChallenge[];
}) {
  const image =
    restaurant.asset?.web2x ??
    restaurant.asset?.full3x ??
    restaurant.asset?.preview1x ??
    null;
  const where = locationLine(locations);
  // Reserve beats website when a location takes reservations.
  const reserve =
    locations.find((location) => location.reservationUrl)?.reservationUrl ??
    null;
  const website = restaurant.websiteUrl ?? null;
  const link = reserve
    ? { href: reserve, label: "Reserve →" }
    : website
      ? { href: website, label: "Website →" }
      : null;

  return (
    <article className="overflow-hidden rounded-2xl bg-surface-low">
      {image ? (
        <div className="relative aspect-[16/10]">
          {/* Discovery serves images from arbitrary CDN hosts, so a plain img
              avoids next/image remote-domain config in a starter. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={restaurant.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <h3 className="absolute bottom-3 left-4 right-4 text-lg font-semibold text-white">
            {restaurant.name}
          </h3>
        </div>
      ) : (
        <h3 className="px-4 pt-4 text-lg font-semibold">{restaurant.name}</h3>
      )}
      <div className="space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {restaurant.cuisine.slice(0, 3).map((cuisine) => (
              <Tag key={cuisine}>{cuisine}</Tag>
            ))}
          </div>
          {typeof restaurant.price === "number" && restaurant.price > 0 && (
            <span className="shrink-0 text-sm text-muted">
              {"$".repeat(Math.min(restaurant.price, 4))}
            </span>
          )}
        </div>
        {specials.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {specials.slice(0, 2).map((special) => (
                <span
                  key={special.id}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {special.emoji && <span aria-hidden>{special.emoji}</span>}
                  {special.label}
                </span>
              ))}
            </div>
            {specials[0]?.description && (
              <p className="line-clamp-1 text-xs text-muted">
                {specials[0].description}
              </p>
            )}
          </div>
        )}
        {challenges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {challenges.slice(0, 2).map((challenge) => (
              <span
                key={challenge.id}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-2 py-0.5 text-xs font-medium text-foreground"
              >
                <span aria-hidden>🎯</span>
                {challenge.title}
              </span>
            ))}
          </div>
        )}
        {typeof checkInCount === "number" && checkInCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <PinIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              {checkInCount.toLocaleString()}{" "}
              {checkInCount === 1 ? "check-in" : "check-ins"}
            </span>
          </div>
        )}
        {(where || link) && (
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-muted">{where}</span>
            {link && (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-medium text-foreground transition duration-150 ease-standard hover:opacity-80"
              >
                {link.label}
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// Map-pin glyph for the check-in stat.
function PinIcon({ className = "" }: { className?: string }) {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
