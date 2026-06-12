"use client";

import { Tag } from "./tag";

export function RewardsPanel({
  completed,
  completedCount,
  totalCount,
  questTitle,
  rewardPreview,
}: {
  completed: boolean;
  completedCount: number;
  totalCount: number;
  questTitle: string;
  rewardPreview: string;
}) {
  return (
    <aside className="rounded-3xl border border-white/10 bg-surface-low p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-subtle">
            Rewards preview
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            {completed ? "Reward unlocked" : "Reward armed"}
          </h2>
        </div>
        <Tag tone={completed ? "success" : "primary"}>
          {completed ? "Simulated" : "Safe mode"}
        </Tag>
      </div>

      <div className="mt-5 grid gap-3">
        <Metric label="Quest" value={questTitle} />
        <Metric
          label="Check-ins"
          value={`${completedCount}/${totalCount} simulated`}
        />
        <Metric label="Unlock" value={rewardPreview} />
        <Metric label="API action" value="No live issuance" />
      </div>

      <div
        className={`mt-5 rounded-2xl border p-4 ${
          completed
            ? "border-success/30 bg-success/10 text-success"
            : "border-primary/25 bg-primary/10 text-primary-bright"
        }`}
      >
        <p className="text-sm font-medium">
          {completed
            ? "Demo state: every planned stop has a simulated check-in."
            : "Mark each stop checked in to preview the Rewards API moment without moving FLY."}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A production version would issue this only after verified check-ins and
          an explicit merchant-side confirmation.
        </p>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background-darker p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}
