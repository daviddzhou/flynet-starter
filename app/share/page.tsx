import Link from "next/link";

import { decodeShareSnapshot, type ShareQuestSnapshot } from "../../lib/share";

type SharePageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams;
  const encoded = Array.isArray(params.q) ? params.q[0] : params.q;
  const snapshot = decodeShareSnapshot(encoded);

  if (!snapshot) {
    return <InvalidSharePage />;
  }

  return <ShareItinerary snapshot={snapshot} />;
}

function ShareItinerary({ snapshot }: { snapshot: ShareQuestSnapshot }) {
  const generatedDate = new Date(snapshot.generatedAt);
  const generatedAt = Number.isNaN(generatedDate.getTime())
    ? "recently"
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(generatedDate);

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 text-[#17130f] sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="rounded-[28px] border border-[#dfd5c2] bg-[#fffaf1] p-5 shadow-[0_18px_50px_rgba(41,31,18,0.12)] sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#17130f] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#fffaf1]">
              Passport Quest
            </span>
            <span className="rounded-full border border-[#d7c8af] bg-white px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#6e5d46]">
              {snapshot.trackLabel}
            </span>
          </div>

          <h1 className="text-balance text-3xl font-black leading-[0.95] tracking-[-0.02em] text-[#1d1710] sm:text-5xl">
            {snapshot.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[#665744] sm:text-base">
            {snapshot.stopCount} stops, {snapshot.windowLabel}. {snapshot.routeSummary}
          </p>

          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
            <Metric label="Cadence" value={snapshot.cadenceLabel} />
            <Metric label="Reward" value={snapshot.rewardLabel} />
            <Metric label="Challenge" value={snapshot.challengeId} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {snapshot.directionsUrl ? (
              <a
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#f5c243] px-5 text-sm font-black text-[#1c160f] shadow-[0_10px_24px_rgba(92,70,21,0.18)] transition hover:translate-y-[-1px]"
                href={snapshot.directionsUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open Google Maps route
              </a>
            ) : null}
            <Link
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#d8ccb8] bg-white px-5 text-sm font-black text-[#2b2117]"
              href="/"
            >
              Build another quest
            </Link>
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#917d60]">
            Generated {generatedAt}
          </p>
        </header>

        <section className="rounded-[28px] border border-[#dfd5c2] bg-white p-4 shadow-[0_18px_50px_rgba(41,31,18,0.1)] sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4b3c29]">
              Ordered itinerary
            </h2>
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#9a876b]">
              {snapshot.stopCount} stops
            </span>
          </div>

          <ol className="space-y-3">
            {snapshot.stops.map((stop) => (
              <li
                className="grid grid-cols-[2.75rem_1fr] gap-3 rounded-2xl border border-[#eee5d6] bg-[#fffaf1] p-3"
                key={`${stop.index}-${stop.name}`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#17130f] text-base font-black text-[#fffaf1]">
                  {stop.index}
                </span>
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-lg font-black leading-tight text-[#211811]">{stop.name}</h3>
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-[#9b7040]">
                      {stop.legLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#5d4e3c]">{stop.cuisines}</p>
                  <p className="mt-2 text-sm leading-5 text-[#6f604d]">
                    {stop.addressLine ?? stop.locationLabel}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-[#8c7a61]">
          Rewards are shown as a preview until a merchant issues them.
        </p>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#eee1cf] bg-white px-4 py-3">
      <div className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[#9a876b]">{label}</div>
      <div className="mt-1 text-sm font-black text-[#211811]">{value}</div>
    </div>
  );
}

function InvalidSharePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f3ea] px-4 py-8 text-[#17130f]">
      <section className="w-full max-w-md rounded-[28px] border border-[#dfd5c2] bg-[#fffaf1] p-6 text-center shadow-[0_18px_50px_rgba(41,31,18,0.12)]">
        <span className="mx-auto inline-flex rounded-full bg-[#17130f] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#fffaf1]">
          Passport Quest
        </span>
        <h1 className="mt-4 text-3xl font-black leading-none tracking-[-0.02em]">This share link expired.</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#665744]">
          Build a fresh quest to generate a new itinerary link.
        </p>
        <Link
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#f5c243] px-5 text-sm font-black text-[#1c160f]"
          href="/"
        >
          Build a quest
        </Link>
      </section>
    </main>
  );
}
