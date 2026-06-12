"use client";

import { Tag } from "./tag";

export function RewardsPanel({
  completed,
  completedCount,
  totalCount,
  questTitle,
  rewardPreview,
  challengeId,
  rewardFly,
  recipientName,
  challengeGenerated,
}: {
  completed: boolean;
  completedCount: number;
  totalCount: number;
  questTitle: string;
  rewardPreview: string;
  challengeId: string;
  rewardFly: number;
  recipientName: string;
  challengeGenerated: boolean;
}) {
  const payoutReference = challengeGenerated
    ? `mock_fly_${challengeId.toLowerCase().replaceAll("-", "_")}`
    : "pending";

  return (
    <aside
      className={`rounded-3xl border p-5 transition ${
        completed
          ? "border-success/30 bg-success/10"
          : "border-white/10 bg-surface-low"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-subtle">
            Rewards preview
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            {completed
              ? `+${rewardFly} FLY unlocked`
              : challengeGenerated
                ? "Reward armed"
                : "Generate challenge first"}
          </h2>
        </div>
        <Tag tone={completed ? "success" : challengeGenerated ? "primary" : "neutral"}>
          {completed ? "Simulated" : challengeGenerated ? "Safe mode" : "Draft"}
        </Tag>
      </div>

      <div className="mt-5 grid gap-3">
        <Metric label="Challenge" value={challengeId} />
        <Metric label="Quest" value={questTitle} />
        <Metric
          label="Check-ins"
          value={`${completedCount}/${totalCount} simulated`}
        />
        <Metric label="Recipient" value={recipientName} />
        <Metric label="Payout" value={`+${rewardFly} FLY`} />
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
            ? `Mock transfer posted: +${rewardFly} FLY to ${recipientName}.`
            : challengeGenerated
              ? "Mark each stop checked in to preview the Rewards API moment without moving FLY."
              : "Generate a challenge to arm the mock reward and enable check-ins."}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {completed
            ? `Reference ${payoutReference}. Production would issue only after verified check-ins and merchant confirmation.`
            : challengeGenerated
              ? "A production version would issue this only after verified check-ins and an explicit merchant-side confirmation."
              : "The route can keep updating as a preview until the challenge is generated."}
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
