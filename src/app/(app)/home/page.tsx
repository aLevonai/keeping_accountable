"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import { useDreams } from "@/hooks/use-dreams";
import { countCompletionsInPeriod, getPeriodRange } from "@/utils/period";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import { HomeSkeleton } from "@/components/ui/page-skeleton";
import { Check, Plus } from "lucide-react";
import { AppLogo } from "@/components/ui/logo";

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function countWeeklyCheckIns(goals: GoalWithCompletions[], userId: string): number {
  const range = getPeriodRange("weekly");
  if (!range) return 0;
  let total = 0;
  for (const g of goals) {
    total += g.completions.filter(c => {
      if (c.user_id !== userId) return false;
      const d = new Date(c.completed_at);
      return d >= range.start && d <= range.end;
    }).length;
  }
  return total;
}

function ScoreCard({
  selfName,
  partnerName,
  selfInitial,
  partnerInitial,
  myCount,
  partnerCount,
}: {
  selfName: string;
  partnerName: string;
  selfInitial: string;
  partnerInitial: string;
  myCount: number;
  partnerCount: number;
}) {
  const total = myCount + partnerCount;
  const myPct = total > 0 ? (myCount / total) * 100 : 50;
  const partnerPct = total > 0 ? (partnerCount / total) * 100 : 50;

  return (
    <div className="mx-4 mb-3 bg-[--surface] rounded-2xl border border-[--border] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[--muted] mb-3">
        This week
      </p>

      {/* Relative bar */}
      <div className="flex h-[6px] rounded-full overflow-hidden gap-[2px] mb-3">
        <div
          className="h-full rounded-l-full transition-all duration-500"
          style={{ width: `${myPct}%`, background: "var(--primary)" }}
        />
        <div
          className="h-full rounded-r-full transition-all duration-500"
          style={{ width: `${partnerPct}%`, background: "var(--partner-accent)" }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: "var(--primary-light)", color: "var(--primary)", border: "1.5px solid rgba(196,112,79,0.4)" }}
          >
            {selfInitial}
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[--foreground]">You</p>
            <p className="text-[11px] text-[--muted]">{myCount} check-in{myCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-row-reverse">
          <div
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: "var(--partner-light)", color: "var(--partner-accent)", border: "1.5px solid rgba(74,122,155,0.4)" }}
          >
            {partnerInitial}
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold text-[--foreground]">{partnerName}</p>
            <p className="text-[11px] text-[--muted]">{partnerCount} check-in{partnerCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpNextRow({ goal, userId, partnerId }: {
  goal: GoalWithCompletions;
  userId: string;
  partnerId: string;
}) {
  const isShared = goal.owner_id === null;
  const myCount = isShared
    ? countCompletionsInPeriod(goal.completions.filter(c => c.user_id === userId), goal.cadence)
    : countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const myDone = myCount >= target;
  const chipColor = goal.color ?? "#374151";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[--border] last:border-0">
      <div
        className="flex-shrink-0 mt-px"
        style={{ width: 10, height: 10, borderRadius: 2, background: chipColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-[--foreground] truncate">{goal.title}</p>
        <p className="text-[11px] text-[--muted]">
          {myCount}/{target} {goal.cadence}
          {isShared && " · Shared"}
        </p>
      </div>
      {myDone ? (
        <div className="w-[26px] h-[26px] rounded-full bg-[--success-light] flex items-center justify-center flex-shrink-0">
          <Check size={11} className="text-[--success]" />
        </div>
      ) : (
        <Link
          href={`/check-in/${goal.id}`}
          className="w-[26px] h-[26px] flex items-center justify-center rounded-full font-semibold text-[16px] leading-none active:scale-95 transition-transform flex-shrink-0"
          style={{
            background: chipColor + "20",
            border: `1px solid ${chipColor}50`,
            color: chipColor,
          }}
        >+</Link>
      )}
    </div>
  );
}

function PartnerActivityRow({ goal, partnerId }: {
  goal: GoalWithCompletions;
  partnerId: string;
}) {
  const count = countCompletionsInPeriod(
    goal.completions.filter(c => c.user_id === partnerId),
    goal.cadence
  );
  const target = goal.cadence_target;
  const done = count >= target;
  const chipColor = goal.color ?? "#374151";

  return (
    <div className="flex items-center gap-3 py-2 border-b border-[--border] last:border-0" style={{ opacity: 0.82 }}>
      <div
        className="flex-shrink-0"
        style={{ width: 10, height: 10, borderRadius: 2, background: chipColor }}
      />
      <span className="text-[13px] text-[--foreground] flex-1 truncate">{goal.title}</span>
      <span className="text-[11px] text-[--muted] flex-shrink-0">
        {done ? "✓" : `${count}/${target}`}
      </span>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { couple, partner, self, loading: coupleLoading, goalsLoading, goals } = useAppData();
  const { dreams } = useDreams(couple?.id);
  const loading = !user || coupleLoading || goalsLoading;

  if (loading) return <HomeSkeleton />;

  if (!couple) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-3 text-center">
        <p className="font-semibold text-[--foreground]">Waiting for your partner</p>
        <p className="text-sm text-[--muted]">Share your invite code from the Profile tab so they can join.</p>
      </div>
    );
  }

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();

  const myGoals = goals.filter(g => g.owner_id === user?.id || g.owner_id === null);
  const partnerGoals = goals.filter(g => g.owner_id === partner?.id || g.owner_id === null);

  const isDoneForMe = (g: GoalWithCompletions) => {
    const isShared = g.owner_id === null;
    const myCount = isShared
      ? countCompletionsInPeriod(g.completions.filter(c => c.user_id === user!.id), g.cadence)
      : countCompletionsInPeriod(g.completions, g.cadence);
    return g.cadence === "once" ? myCount >= 1 : myCount >= g.cadence_target;
  };

  const myCheckIns = countWeeklyCheckIns(goals, user!.id);
  const partnerCheckIns = partner ? countWeeklyCheckIns(goals, partner.id) : 0;

  const selfInitial = getInitial(self?.display_name ?? "Y");
  const partnerInitial = getInitial(partner?.display_name ?? "P");
  const partnerFirstName = partner?.display_name.split(" ")[0] ?? "Partner";

  // "Up next for you" — not done, my goals + shared goals, max 3
  const upNext = myGoals
    .filter(g => !isDoneForMe(g))
    .slice(0, 3);

  // Partner activity — partner's goals + shared, sorted by most recent completion this period, max 3
  const partnerActivity = partnerGoals
    .filter(g => g.owner_id === partner?.id)
    .slice(0, 3);

  const sharedDreams = dreams.filter(d => d.owner_id === null && d.achieved_at === null).slice(0, 3);

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[--muted]">{dateLabel}</p>
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground] leading-tight mt-0.5">
            CheckMate
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/goals/new"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white active:scale-95 transition-transform duration-150"
          >
            <Plus size={18} />
          </Link>
          <AppLogo size={38} />
        </div>
      </div>

      {/* Score card */}
      {partner && (
        <ScoreCard
          selfName={self?.display_name ?? "You"}
          partnerName={partnerFirstName}
          selfInitial={selfInitial}
          partnerInitial={partnerInitial}
          myCount={myCheckIns}
          partnerCount={partnerCheckIns}
        />
      )}

      {/* Up next for you */}
      {upNext.length > 0 && (
        <div className="mx-4 mb-3 bg-[--surface] rounded-2xl border border-[--border] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[--muted] mb-1">
            Up next for you
          </p>
          <div>
            {upNext.map(g => (
              <UpNextRow
                key={g.id}
                goal={g}
                userId={user!.id}
                partnerId={partner?.id ?? ""}
              />
            ))}
          </div>
          {myGoals.filter(g => !isDoneForMe(g)).length > 3 && (
            <Link href="/goals" className="block text-[12px] text-[--primary] font-medium mt-2">
              View all goals →
            </Link>
          )}
        </div>
      )}

      {/* Partner this week */}
      {partner && partnerActivity.length > 0 && (
        <div className="mx-4 mb-3 bg-[--surface] rounded-2xl border border-[--border] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
              style={{ background: "var(--partner-light)", color: "var(--partner-accent)", border: "1.5px solid rgba(74,122,155,0.4)" }}
            >
              {partnerInitial}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[--muted]">
              {partnerFirstName} this week
            </p>
          </div>
          <div>
            {partnerActivity.map(g => (
              <PartnerActivityRow
                key={g.id}
                goal={g}
                partnerId={partner.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Shared dreams */}
      {sharedDreams.length > 0 && (
        <div className="mb-3">
          <div className="px-5 mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[--muted]">
              Shared dreams
            </p>
            <Link href="/dreams" className="text-[11px] text-[--primary]">See all</Link>
          </div>
          <div className="flex gap-2.5 px-4 overflow-x-auto scrollbar-hide pb-1">
            {sharedDreams.map(d => (
              <Link
                key={d.id}
                href="/dreams"
                className="flex-shrink-0 bg-[--surface] rounded-xl border border-[--border] px-3.5 py-3 min-w-[140px] max-w-[160px] active:scale-95 transition-transform"
              >
                <p className="text-[13px] font-medium text-[--foreground] line-clamp-2">{d.title}</p>
                {d.note && <p className="text-[11px] text-[--muted] mt-1 line-clamp-1">{d.note}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center px-5">
          <p className="text-[--muted] text-sm">No goals yet.</p>
          <Link href="/goals/new" className="text-sm font-medium text-[--primary]">Add your first goal →</Link>
        </div>
      )}
    </div>
  );
}
