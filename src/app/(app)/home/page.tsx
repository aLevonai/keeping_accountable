"use client";

import Link from "next/link";
import { useAppData } from "@/contexts/app-data";
import { useDreams } from "@/hooks/use-dreams";
import { getPeriodRange } from "@/utils/period";
import { goalProgress } from "@/utils/goal-progress";
import type { GoalWithCompletions } from "@/types/database";
import { HomeSkeleton } from "@/components/ui/page-skeleton";
import { Check, Plus } from "lucide-react";
import { AppLogo } from "@/components/ui/logo";
import { Avatar, firstName } from "@/components/ui/bits";
import { CheckInButton } from "@/components/check-in-button";
import { usePrefetchGoalHistory } from "@/hooks/use-goal";

function countWeeklyCheckIns(goals: GoalWithCompletions[], userId: string): number {
  const range = getPeriodRange("weekly")!;
  let total = 0;
  for (const g of goals) {
    for (const c of g.completions) {
      if (c.user_id !== userId) continue;
      const d = new Date(c.completed_at);
      if (d >= range.start && d <= range.end) total++;
    }
  }
  return total;
}

function ScoreCard({
  selfName,
  partnerName,
  myCount,
  partnerCount,
}: {
  selfName: string;
  partnerName: string;
  myCount: number;
  partnerCount: number;
}) {
  const total = myCount + partnerCount;
  const myPct = total > 0 ? (myCount / total) * 100 : 50;
  const partnerPct = total > 0 ? (partnerCount / total) * 100 : 50;

  return (
    <div className="mx-4 mb-3 bg-surface rounded-2xl border border-border p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted mb-3">This week</p>

      <div className="flex h-[6px] rounded-full overflow-hidden gap-[2px] mb-3">
        <div className="h-full rounded-l-full transition-all duration-500" style={{ width: `${myPct}%`, background: "var(--primary)" }} />
        <div className="h-full rounded-r-full transition-all duration-500" style={{ width: `${partnerPct}%`, background: "var(--partner-accent)" }} />
      </div>

      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={selfName} who="self" size={22} />
          <div>
            <p className="text-[12px] font-semibold text-foreground">You</p>
            <p className="text-[11px] text-muted">{myCount} check-in{myCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-row-reverse">
          <Avatar name={partnerName} who="partner" size={22} />
          <div className="text-right">
            <p className="text-[12px] font-semibold text-foreground">{partnerName}</p>
            <p className="text-[11px] text-muted">{partnerCount} check-in{partnerCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function YourGoalRow({ goal, userId, partnerId }: { goal: GoalWithCompletions; userId: string; partnerId?: string }) {
  const p = goalProgress(goal, userId, partnerId);
  const prefetchHistory = usePrefetchGoalHistory();
  const chipColor = goal.color ?? "#374151";
  const label =
    goal.cadence === "once"
      ? p.myDone ? "Done" : "One-time"
      : `${p.myCount}/${p.target} ${goal.cadence}`;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <Link
        href={`/goals/${goal.id}`}
        onPointerDown={() => prefetchHistory(goal.id)}
        className="flex items-center gap-3 flex-1 min-w-0 active:opacity-60 transition-opacity"
      >
        <div className="flex-shrink-0 mt-px" style={{ width: 10, height: 10, borderRadius: 2, background: chipColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-foreground truncate">{goal.title}</p>
          <p className="text-[11px] text-muted">
            {label}
            {p.mode === "joint" && " · Together"}
            {p.mode === "separate" && " · Shared"}
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-1 flex-shrink-0">
        {p.myDone && (
          <div className="w-[20px] h-[20px] rounded-full bg-success-light flex items-center justify-center flex-shrink-0">
            <Check size={9} className="text-success" />
          </div>
        )}
        <CheckInButton goal={goal} subdued={p.myDone} />
      </div>
    </div>
  );
}

function PartnerRow({ goal, userId, partnerId }: { goal: GoalWithCompletions; userId: string; partnerId: string }) {
  const p = goalProgress(goal, userId, partnerId);
  const chipColor = goal.color ?? "#374151";
  return (
    <Link
      href={`/goals/${goal.id}`}
      className="flex items-center gap-3 py-2 border-b border-border last:border-0 active:opacity-60 transition-opacity"
      style={{ opacity: 0.85 }}
    >
      <div className="flex-shrink-0" style={{ width: 10, height: 10, borderRadius: 2, background: chipColor }} />
      <span className="text-[13px] text-foreground flex-1 truncate">{goal.title}</span>
      <span className="text-[11px] text-muted flex-shrink-0">
        {p.done ? "✓" : `${p.partnerCount}/${p.target}`}
      </span>
    </Link>
  );
}

export default function HomePage() {
  const { user, couple, partner, self, loading, goalsLoading, goals } = useAppData();
  const { dreams } = useDreams(couple?.id);

  if (loading || goalsLoading || !user) return <HomeSkeleton />;

  if (!couple) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 gap-3 text-center">
        <p className="font-semibold text-foreground">You&apos;re not paired yet</p>
        <Link href="/onboard" className="text-sm font-medium text-primary">Start or join a couple →</Link>
      </div>
    );
  }

  const dateLabel = new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();

  const isDoneForMe = (g: GoalWithCompletions) => goalProgress(g, user.id, partner?.id).myDone;
  const myGoals = goals.filter((g) => g.owner_id === user.id || g.owner_id === null);
  const upNext = [...myGoals.filter((g) => !isDoneForMe(g)), ...myGoals.filter(isDoneForMe)];
  const partnerGoals = partner ? goals.filter((g) => g.owner_id === partner.id) : [];
  const partnerFirstName = firstName(partner?.display_name, "Partner");
  const sharedDreams = dreams.filter((d) => d.owner_id === null && d.achieved_at === null);

  return (
    <div className="pb-4">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted">{dateLabel}</p>
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-foreground leading-tight mt-0.5">
            CheckMate
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/goals/new"
            aria-label="New goal"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white active:scale-95 transition-transform duration-150"
          >
            <Plus size={18} />
          </Link>
          <AppLogo size={38} />
        </div>
      </div>

      {partner ? (
        <ScoreCard
          selfName={self?.display_name ?? "You"}
          partnerName={partnerFirstName}
          myCount={countWeeklyCheckIns(goals, user.id)}
          partnerCount={countWeeklyCheckIns(goals, partner.id)}
        />
      ) : (
        <Link
          href="/profile"
          className="mx-4 mb-3 flex items-center justify-between bg-primary-light rounded-2xl border border-primary/25 px-4 py-3.5 active:scale-[0.99] transition-transform"
        >
          <div>
            <p className="text-[14px] font-semibold text-foreground">Waiting for your partner</p>
            <p className="text-[12px] text-muted mt-0.5">Share your invite link so they can join</p>
          </div>
          <span className="text-[13px] font-semibold text-primary">Invite →</span>
        </Link>
      )}

      {upNext.length > 0 && (
        <div className="mx-4 mb-3 bg-surface rounded-2xl border border-border px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted mb-1">Your goals</p>
          {upNext.map((g) => (
            <YourGoalRow key={g.id} goal={g} userId={user.id} partnerId={partner?.id} />
          ))}
        </div>
      )}

      {partner && partnerGoals.length > 0 && (
        <div className="mx-4 mb-3 bg-surface rounded-2xl border border-border px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Avatar name={partner.display_name} who="partner" />
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{partnerFirstName} this week</p>
          </div>
          {partnerGoals.map((g) => (
            <PartnerRow key={g.id} goal={g} userId={user.id} partnerId={partner.id} />
          ))}
        </div>
      )}

      {sharedDreams.length > 0 && (
        <div className="mb-3">
          <div className="px-5 mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Shared dreams</p>
            <Link href="/dreams" className="text-[11px] text-primary">See all</Link>
          </div>
          <div className="flex gap-2.5 px-4 overflow-x-auto scrollbar-hide pb-1">
            {sharedDreams.map((d) => (
              <Link
                key={d.id}
                href="/dreams"
                className="flex-shrink-0 bg-surface rounded-xl border border-border px-3.5 py-3 min-w-[140px] max-w-[160px] active:scale-95 transition-transform"
              >
                <p className="text-[13px] font-medium text-foreground line-clamp-2">{d.title}</p>
                {d.note && <p className="text-[11px] text-muted mt-1 line-clamp-1">{d.note}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center px-5">
          <p className="text-muted text-sm">No goals yet.</p>
          <Link href="/goals/new" className="text-sm font-medium text-primary">Add your first goal →</Link>
        </div>
      )}
    </div>
  );
}
