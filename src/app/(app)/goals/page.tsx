"use client";

import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";
import { countCompletionsInPeriod } from "@/utils/period";
import { startOfWeek, addDays, isSameDay, isAfter } from "date-fns";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import { GoalsSkeleton } from "@/components/ui/page-skeleton";

type Filter = "all" | "mine" | "shared" | "partner";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

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
            <div className={`w-1.5 h-1.5 rounded-full ${filled ? "bg-[--primary]" : "bg-[--border]"}`} />
            <span className="text-[8px] text-[--muted]">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ count, target, color = "var(--primary)" }: { count: number; target: number; color?: string }) {
  const pct = target > 0 ? Math.min(count / target, 1) * 100 : 0;
  return (
    <div className="flex-1 h-[3px] rounded-full bg-[--border] overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function GoalCard({ goal, userId, partnerId, partnerName }: {
  goal: GoalWithCompletions;
  userId: string;
  partnerId: string;
  partnerName: string;
}) {
  const router = useRouter();
  const isShared = goal.owner_id === null;
  const isOwn = goal.owner_id === userId;
  const isPartner = goal.owner_id === partnerId;

  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const done = goal.cadence === "once" ? count >= 1 : count >= target;

  const myCount = isShared ? countCompletionsInPeriod(
    goal.completions.filter((c) => c.user_id === userId),
    goal.cadence
  ) : count;
  const partnerCount = isShared ? countCompletionsInPeriod(
    goal.completions.filter((c) => c.user_id === partnerId),
    goal.cadence
  ) : 0;
  const myDone = myCount >= target;

  // Joint: done when total hits target. Individual shared: done (for you) when your count hits target.
  const canCheckIn = isOwn
    ? !done
    : isShared
    ? (goal.is_joint ? !done : !myDone)
    : false;

  return (
    <div
      onClick={() => router.push(`/goals/${goal.id}`)}
      className="bg-[--surface] rounded-2xl border border-[--border] p-3.5 flex flex-col gap-2 active:scale-[0.98] transition-transform duration-150 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-medium text-[--foreground] truncate">{goal.title}</h3>
          {isShared && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[--primary]">Shared</span>
          )}
          {isPartner && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[--muted]">Partner</span>
          )}
        </div>
        {done ? (
          <div className="w-7 h-7 rounded-full bg-[--success-light] flex items-center justify-center flex-shrink-0">
            <Check size={13} className="text-[--success]" />
          </div>
        ) : canCheckIn ? (
          <Link
            href={`/check-in/${goal.id}`}
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 flex items-center justify-center border border-[--border] rounded-full bg-transparent text-[--muted] text-base leading-none active:scale-95 transition-transform flex-shrink-0"
          >
            +
          </Link>
        ) : null}
      </div>

      {/* Progress */}
      {isShared && goal.cadence !== "once" && (
        goal.is_joint ? (
          // Joint: single bar showing total count
          <div className="flex items-center gap-1.5">
            <ProgressBar count={count} target={target} color={done ? "var(--success)" : "var(--primary)"} />
            <span className="text-[10px] text-[--muted] w-[20px] text-right">{count}/{target}</span>
          </div>
        ) : (
          // Individual shared: dual bars
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[--muted] w-[44px] shrink-0">You</span>
              <ProgressBar count={myCount} target={target} color={myDone ? "var(--success)" : "var(--primary)"} />
              <span className="text-[10px] text-[--muted] w-[20px] text-right">{myCount}/{target}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[--muted] w-[44px] shrink-0 truncate">{partnerName.split(" ")[0]}</span>
              <ProgressBar count={partnerCount} target={target} color="var(--border)" />
              <span className="text-[10px] text-[--muted] w-[20px] text-right">{partnerCount}/{target}</span>
            </div>
          </div>
        )
      )}

      {!isShared && goal.cadence === "weekly" && (
        <div className="flex items-center justify-between">
          <WeekBar completions={goal.completions} userId={isOwn ? userId : partnerId} />
          <span className="text-[10px] text-[--muted] ml-2">{count}/{target}</span>
        </div>
      )}

      {!isShared && goal.cadence !== "weekly" && goal.cadence !== "once" && (
        <div className="flex items-center gap-1.5">
          <ProgressBar count={count} target={target} color={done ? "var(--success)" : (isPartner ? "var(--muted)" : "var(--primary)")} />
          <span className="text-[10px] text-[--muted] w-[20px] text-right">{count}/{target}</span>
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const { user } = useAuth();
  const { partner, loading: coupleLoading, goals, goalsLoading } = useAppData();
  const loading = !user || coupleLoading || goalsLoading;
  const [filter, setFilter] = useState<Filter>("all");

  if (loading) {
    return (
      <div className="flex flex-col px-5 pt-14 gap-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-16 bg-[--border] rounded-xl animate-pulse" />
          <div className="w-9 h-9 rounded-full bg-[--border] animate-pulse" />
        </div>
        <GoalsSkeleton />
      </div>
    );
  }

  const filtered = goals.filter((g) => {
    if (filter === "mine") return g.owner_id === user?.id;
    if (filter === "shared") return g.owner_id === null;
    if (filter === "partner") return g.owner_id === partner?.id;
    return true;
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "mine", label: "Mine" },
    { key: "shared", label: "Shared" },
    { key: "partner", label: partner?.display_name ?? "Partner" },
  ];

  return (
    <div className="flex flex-col px-5 pt-14 gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground]">Goals</h1>
        <Link
          href="/goals/new"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[--primary] text-[--foreground] active:scale-95 transition-transform duration-150"
        >
          <Plus size={18} />
        </Link>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors duration-150",
              filter === key
                ? "bg-[--primary] text-[--foreground] border border-[--primary]"
                : "bg-transparent text-[--muted] border border-[--border]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <p className="text-[--muted] text-sm">No goals here yet.</p>
          <Link href="/goals/new" className="text-[--primary] font-semibold text-sm">
            Add one
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              userId={user!.id}
              partnerId={partner?.id ?? ""}
              partnerName={partner?.display_name ?? "Partner"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
