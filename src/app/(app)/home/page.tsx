"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import { countCompletionsInPeriod, getPeriodRange } from "@/utils/period";
import { startOfWeek, addDays, isSameDay, isAfter } from "date-fns";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import { HomeSkeleton } from "@/components/ui/page-skeleton";
import { Check } from "lucide-react";
import { AppLogo } from "@/components/ui/logo";

// Mon–Sun labels
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function Avatar({ name, size = 28, className = "" }: { name: string; size?: number; className?: string }) {
  const sizeClass = size === 28 ? "w-7 h-7 text-[11px]" : size === 40 ? "w-10 h-10 text-[13px]" : "w-7 h-7 text-[11px]";
  return (
    <div
      className={`${sizeClass} rounded-full bg-[--primary-light] flex items-center justify-center font-semibold text-[--primary] flex-shrink-0 ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}

function WeekBar({ completions, userId }: { completions: { completed_at: string; user_id?: string }[]; userId?: string }) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const today = new Date();

  const filtered = userId ? completions.filter((c) => c.user_id === userId) : completions;

  return (
    <div className="flex gap-1">
      {WEEKDAYS.map((label, i) => {
        const day = addDays(weekStart, i);
        const filled = filtered.some((c) => isSameDay(new Date(c.completed_at), day));
        const isFuture = isAfter(day, today) && !isSameDay(day, today);
        return (
          <div key={i} className={`flex flex-col items-center gap-0.5 ${isFuture ? "opacity-40" : ""}`}>
            <div
              className={`w-1.5 h-1.5 rounded-full ${filled ? "bg-[--primary]" : "bg-[--border]"}`}
            />
            <span className="text-[8px] text-[--muted]">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ count, target, color = "var(--primary)", height = "h-[3px]" }: {
  count: number;
  target: number;
  color?: string;
  height?: string;
}) {
  const pct = target > 0 ? Math.min(count / target, 1) * 100 : 0;
  return (
    <div className={`flex-1 ${height} rounded-full bg-[--border] overflow-hidden`}>
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out`}
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function DualProgressBars({
  goal,
  myUserId,
  partnerName,
  partnerId,
}: {
  goal: GoalWithCompletions;
  myUserId: string;
  partnerName: string;
  partnerId: string;
}) {
  const myCompletions = goal.completions.filter((c) => c.user_id === myUserId);
  const partnerCompletions = goal.completions.filter((c) => c.user_id === partnerId);
  const myCount = countCompletionsInPeriod(myCompletions, goal.cadence);
  const partnerCount = countCompletionsInPeriod(partnerCompletions, goal.cadence);
  const target = goal.cadence_target;
  const myDone = myCount >= target;

  return (
    <div className="flex flex-col gap-1 mt-1.5">
      {/* You bar */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-[--muted] w-[44px] shrink-0">You</span>
        <ProgressBar count={myCount} target={target} color={myDone ? "var(--success)" : "var(--primary)"} />
        <span className="text-[10px] text-[--muted] w-[20px] text-right">{myCount}/{target}</span>
      </div>
      {/* Partner bar */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-[--muted] w-[44px] shrink-0 truncate">{partnerName.split(" ")[0]}</span>
        <ProgressBar count={partnerCount} target={target} color="var(--border)" />
        <span className="text-[10px] text-[--muted] w-[20px] text-right">{partnerCount}/{target}</span>
      </div>
    </div>
  );
}

function SharedGoalRow({
  goal,
  myUserId,
  partnerName,
  partnerId,
}: {
  goal: GoalWithCompletions;
  myUserId: string;
  partnerName: string;
  partnerId: string;
}) {
  const target = goal.cadence_target;

  // Joint goal: one check-in for both — use total count
  if (goal.is_joint) {
    const totalCount = countCompletionsInPeriod(goal.completions, goal.cadence);
    const done = totalCount >= target;
    return (
      <div className="py-3 border-b border-[--border]">
        <div className="flex items-center justify-between">
          <Link href={`/goals/${goal.id}`} className="flex-1 min-w-0 mr-2">
            <span className="text-[14px] font-medium text-[--foreground] truncate block">{goal.title}</span>
          </Link>
          {done ? (
            <div className="w-8 h-8 rounded-full bg-[--success-light] flex items-center justify-center flex-shrink-0">
              <Check size={14} className="text-[--success]" />
            </div>
          ) : (
            <Link
              href={`/check-in/${goal.id}`}
              className="w-8 h-8 flex items-center justify-center border border-[--border] rounded-full bg-transparent text-[--muted] text-lg leading-none active:scale-95 transition-transform flex-shrink-0"
            >
              +
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <ProgressBar count={totalCount} target={target} color={done ? "var(--success)" : "var(--primary)"} />
          <span className="text-[10px] text-[--muted] w-[20px] text-right">{totalCount}/{target}</span>
        </div>
      </div>
    );
  }

  // Individual shared goal: each person tracks separately
  const myCompletions = goal.completions.filter((c) => c.user_id === myUserId);
  const myCount = countCompletionsInPeriod(myCompletions, goal.cadence);
  const myDone = myCount >= target;

  return (
    <div className="py-3 border-b border-[--border]">
      <div className="flex items-center justify-between">
        <Link href={`/goals/${goal.id}`} className="flex-1 min-w-0 mr-2">
          <span className="text-[14px] font-medium text-[--foreground] truncate block">{goal.title}</span>
        </Link>
        {myDone ? (
          <div className="w-8 h-8 rounded-full bg-[--success-light] flex items-center justify-center flex-shrink-0">
            <Check size={14} className="text-[--success]" />
          </div>
        ) : (
          <Link
            href={`/check-in/${goal.id}`}
            className="w-8 h-8 flex items-center justify-center border border-[--border] rounded-full bg-transparent text-[--muted] text-lg leading-none active:scale-95 transition-transform flex-shrink-0"
          >
            +
          </Link>
        )}
      </div>
      <DualProgressBars goal={goal} myUserId={myUserId} partnerName={partnerName} partnerId={partnerId} />
    </div>
  );
}

function MyGoalRow({ goal, userId }: { goal: GoalWithCompletions; userId: string }) {
  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const done = goal.cadence === "once" ? count >= 1 : count >= target;

  return (
    <div className="py-3 border-b border-[--border]">
      <div className="flex items-center justify-between">
        <Link href={`/goals/${goal.id}`} className="flex-1 min-w-0 mr-2">
          <span className="text-[14px] font-medium text-[--foreground] truncate block">{goal.title}</span>
        </Link>
        {done ? (
          <div className="w-8 h-8 rounded-full bg-[--success-light] flex items-center justify-center flex-shrink-0">
            <Check size={14} className="text-[--success]" />
          </div>
        ) : (
          <Link
            href={`/check-in/${goal.id}`}
            className="w-8 h-8 flex items-center justify-center border border-[--border] rounded-full bg-transparent text-[--muted] text-lg leading-none active:scale-95 transition-transform flex-shrink-0"
          >
            +
          </Link>
        )}
      </div>
      {goal.cadence === "weekly" ? (
        <div className="mt-2 flex items-center justify-between">
          <WeekBar completions={goal.completions} userId={userId} />
          <span className="text-[10px] text-[--muted] ml-2">{count}/{target}</span>
        </div>
      ) : goal.cadence !== "once" ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <ProgressBar count={count} target={target} color={done ? "var(--success)" : "var(--primary)"} />
          <span className="text-[10px] text-[--muted] w-[20px] text-right">{count}/{target}</span>
        </div>
      ) : (
        <span className="text-[10px] text-[--muted] mt-1 block">{done ? "Done" : "Not done yet"}</span>
      )}
    </div>
  );
}

function PartnerGoalRow({ goal }: { goal: GoalWithCompletions }) {
  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;

  return (
    <div className="py-3 border-b border-[--border] opacity-75">
      <div className="flex items-center justify-between">
        <Link href={`/goals/${goal.id}`} className="flex-1 min-w-0 mr-2">
          <span className="text-[14px] font-medium text-[--foreground] truncate block">{goal.title}</span>
        </Link>
      </div>
      {goal.cadence === "weekly" ? (
        <div className="mt-2 flex items-center justify-between">
          <WeekBar completions={goal.completions} />
          <span className="text-[10px] text-[--muted] ml-2">{count}/{target}</span>
        </div>
      ) : goal.cadence !== "once" ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <ProgressBar count={count} target={target} color="var(--muted)" />
          <span className="text-[10px] text-[--muted] w-[20px] text-right">{count}/{target}</span>
        </div>
      ) : (
        <span className="text-[10px] text-[--muted] mt-1 block">{count >= 1 ? "Done" : "Not done yet"}</span>
      )}
    </div>
  );
}

function countWeeklyCheckIns(goals: GoalWithCompletions[], userId: string): number {
  const range = getPeriodRange("weekly");
  if (!range) return 0;
  let total = 0;
  for (const g of goals) {
    const userCompletions = g.completions.filter((c) => c.user_id === userId);
    total += userCompletions.filter((c) => {
      const d = new Date(c.completed_at);
      return d >= range.start && d <= range.end;
    }).length;
  }
  return total;
}

export default function HomePage() {
  const { user } = useAuth();
  const { couple, partner, self, loading: coupleLoading, goalsLoading, goals } = useAppData();

  const loading = !user || coupleLoading || goalsLoading;

  if (loading) {
    return <HomeSkeleton />;
  }

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
  const coupleName = `${self?.display_name ?? "You"} & ${partner?.display_name ?? "Partner"}`;

  const sharedGoals = goals.filter((g) => g.owner_id === null);
  const myGoals = goals.filter((g) => g.owner_id === user?.id);
  const partnerGoals = goals.filter((g) => g.owner_id === partner?.id);

  const myCheckIns = countWeeklyCheckIns(goals, user!.id);
  const partnerCheckIns = partner ? countWeeklyCheckIns(goals, partner.id) : 0;

  // Together progress: goals where either partner has met target
  const allCoupledGoals = [...sharedGoals, ...myGoals, ...partnerGoals];
  const goalsOnTrack = allCoupledGoals.filter((g) => {
    const count = countCompletionsInPeriod(g.completions, g.cadence);
    return count >= g.cadence_target;
  }).length;
  const totalGoals = allCoupledGoals.length;

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[--muted]">{dateLabel}</p>
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground] leading-tight mt-0.5">
            {coupleName}
          </h1>
        </div>
        <AppLogo size={38} />
      </div>

      {/* Partner split card */}
      {partner && (
        <div className="mx-4 mb-5 bg-[--surface] rounded-2xl border border-[--border] overflow-hidden">
          <div className="flex">
            {/* Me */}
            <div className="flex-1 p-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Avatar name={self?.display_name ?? "You"} size={28} />
                <span className="text-[13px] font-semibold text-[--foreground] truncate">{self?.display_name ?? "You"}</span>
              </div>
              <p className="text-[28px] font-light text-[--foreground] leading-none mt-1">{myCheckIns}</p>
              <p className="text-[10px] text-[--muted]">this week</p>
            </div>
            {/* Divider */}
            <div className="w-px bg-[--border]" />
            {/* Partner */}
            <div className="flex-1 p-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Avatar name={partner.display_name} size={28} />
                <span className="text-[13px] font-semibold text-[--foreground] truncate">{partner.display_name}</span>
              </div>
              <p className="text-[28px] font-light text-[--foreground] leading-none mt-1">{partnerCheckIns}</p>
              <p className="text-[10px] text-[--muted]">this week</p>
            </div>
          </div>
          {/* Bottom strip */}
          <div className="bg-[--surface-alt] px-4 py-2 flex items-center gap-3">
            <span className="text-[10px] font-semibold text-[--muted] uppercase tracking-[0.06em]">Together</span>
            <div className="flex-1">
              <ProgressBar count={goalsOnTrack} target={totalGoals || 1} height="h-[4px]" />
            </div>
            <span className="text-[10px] text-[--muted]">{goalsOnTrack}/{totalGoals} goals</span>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-5">
          <p className="text-[--muted] text-sm">No goals yet.</p>
          <Link href="/goals/new" className="text-sm font-medium text-[--primary]">Add your first goal</Link>
        </div>
      ) : (
        <div className="px-5">
          {/* Shared goals */}
          {sharedGoals.length > 0 && (
            <section className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[--muted] mb-1">Shared</p>
              {sharedGoals.map((g) => (
                <SharedGoalRow
                  key={g.id}
                  goal={g}
                  myUserId={user!.id}
                  partnerName={partner?.display_name ?? "Partner"}
                  partnerId={partner?.id ?? ""}
                />
              ))}
            </section>
          )}

          {/* My goals */}
          {myGoals.length > 0 && (
            <section className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[--muted] mb-1">You</p>
              {myGoals.map((g) => (
                <MyGoalRow key={g.id} goal={g} userId={user!.id} />
              ))}
            </section>
          )}

          {/* Partner goals */}
          {partnerGoals.length > 0 && (
            <section className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[--muted] mb-1">
                {partner?.display_name ?? "Partner"}
              </p>
              {partnerGoals.map((g) => (
                <PartnerGoalRow key={g.id} goal={g} />
              ))}
            </section>
          )}
        </div>
      )}

      <div className="px-5 mt-2">
        <Link href="/goals/new" className="text-sm font-medium text-[--primary]">+ New goal</Link>
      </div>
    </div>
  );
}
