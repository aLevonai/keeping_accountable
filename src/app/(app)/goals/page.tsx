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

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]; // Sun–Sat

const CADENCE_META: Record<string, { color: string; dot: string; label: string }> = {
  weekly:  { color: "#3D7060", dot: "#4A9078", label: "Weekly" },
  monthly: { color: "#5A4A8A", dot: "#7B62C8", label: "Monthly" },
  yearly:  { color: "#B87333", dot: "#E8923A", label: "Yearly" },
  once:    { color: "#9C8B7E", dot: "#9C8B7E", label: "One-time" },
};
const CADENCE_ORDER = ["weekly", "monthly", "yearly", "once"];

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function CadenceHeader({ cadence }: { cadence: string }) {
  const m = CADENCE_META[cadence] ?? CADENCE_META.once;
  return (
    <div className="flex items-center gap-2 mt-5 mb-2.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.dot }} />
      <span className="text-[11px] font-bold tracking-[0.09em] uppercase" style={{ color: m.color }}>{m.label}</span>
      <div className="flex-1 h-px" style={{ background: m.color + "22" }} />
    </div>
  );
}

function MiniAvatar({ initial, variant }: { initial: string; variant: "self" | "partner" }) {
  const bg = variant === "partner" ? "var(--partner-light)" : "var(--primary-light)";
  const fg = variant === "partner" ? "var(--partner-accent)" : "var(--primary)";
  const borderColor = variant === "partner" ? "rgba(74,122,155,0.4)" : "rgba(196,112,79,0.4)";
  return (
    <div
      className="w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0"
      style={{ background: bg, color: fg, border: `1.5px solid ${borderColor}` }}
    >
      {initial}
    </div>
  );
}

function WeekBar({ completions, userId, color }: {
  completions: { completed_at: string; user_id?: string }[];
  userId?: string;
  color: string;
}) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const today = new Date();
  const filtered = userId ? completions.filter(c => c.user_id === userId) : completions;
  return (
    <div className="flex gap-1">
      {WEEKDAYS.map((_, i) => {
        const day = addDays(weekStart, i);
        const filled = filtered.some(c => isSameDay(new Date(c.completed_at), day));
        const isFuture = isAfter(day, today) && !isSameDay(day, today);
        return (
          <div key={i} className={isFuture ? "opacity-40" : ""}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: filled ? color : "var(--border)" }} />
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ count, target, color }: { count: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(count / target, 1) * 100 : 0;
  return (
    <div className="flex-1 h-[3px] rounded-full bg-[--border] overflow-hidden">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function ProgressBar4({ count, target, color }: { count: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(count / target, 1) * 100 : 0;
  return (
    <div className="flex-1 h-[4px] rounded-full bg-[--border] overflow-hidden">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function GoalCard({ goal, userId, partnerId, partnerName, selfInitial, partnerInitial }: {
  goal: GoalWithCompletions;
  userId: string;
  partnerId: string;
  partnerName: string;
  selfInitial: string;
  partnerInitial: string;
}) {
  const router = useRouter();
  const isShared = goal.owner_id === null;
  const isOwn = goal.owner_id === userId;
  const isPartner = goal.owner_id === partnerId;

  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const done = goal.cadence === "once" ? count >= 1 : count >= target;

  const myCount = isShared ? countCompletionsInPeriod(
    goal.completions.filter(c => c.user_id === userId),
    goal.cadence
  ) : count;
  const partnerCount = isShared ? countCompletionsInPeriod(
    goal.completions.filter(c => c.user_id === partnerId),
    goal.cadence
  ) : 0;
  const myDone = myCount >= target;
  const partnerDone = partnerCount >= target;

  const canCheckIn = isOwn
    ? !done
    : isShared
    ? (goal.is_joint ? !done : !myDone)
    : false;

  const barColor = done
    ? "var(--success)"
    : isPartner
    ? "var(--partner-accent)"
    : "var(--primary)";

  const cadencePeriodLabel = goal.cadence === "weekly" ? "this week" : goal.cadence === "monthly" ? "this month" : goal.cadence === "yearly" ? "this year" : "";

  const borderStyle: React.CSSProperties = done
    ? { borderColor: "rgba(90,138,106,0.4)" }
    : isShared
    ? { borderColor: "rgba(196,112,79,0.28)" }
    : isPartner
    ? { borderColor: "rgba(74,122,155,0.28)" }
    : {};

  return (
    <div
      onClick={() => router.push(`/goals/${goal.id}`)}
      className="bg-[--surface] rounded-[14px] border border-[--border] p-3.5 flex flex-col gap-2.5 active:scale-[0.98] transition-transform duration-150 cursor-pointer"
      style={borderStyle}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="text-[14px] font-medium text-[--foreground] truncate">{goal.title}</span>
          {isShared && (
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[--primary]">Shared</span>
          )}
          {isPartner && (
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] flex items-center gap-1" style={{ color: "var(--partner-accent)" }}>
              <span
                className="w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold"
                style={{ background: "var(--partner-light)", color: "var(--partner-accent)" }}
              >{partnerInitial}</span>
              {partnerName.split(" ")[0]}&apos;s
            </span>
          )}
        </div>
        {done ? (
          <div className="w-7 h-7 rounded-full bg-[--success-light] flex items-center justify-center flex-shrink-0">
            <Check size={13} className="text-[--success]" />
          </div>
        ) : canCheckIn ? (
          <Link
            href={`/check-in/${goal.id}`}
            onClick={e => e.stopPropagation()}
            className="w-7 h-7 flex items-center justify-center border border-[--border] rounded-full text-[--muted] text-base leading-none active:scale-95 transition-transform flex-shrink-0"
          >+</Link>
        ) : null}
      </div>

      {/* Progress */}
      {isShared && goal.cadence !== "once" && (
        goal.is_joint ? (
          <div className="flex items-center gap-1.5">
            <ProgressBar count={count} target={target} color={done ? "var(--success)" : "var(--primary)"} />
            <span className="text-[10px] text-[--muted] w-[22px] text-right">{count}/{target}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <MiniAvatar initial={selfInitial} variant="self" />
              <ProgressBar4 count={myCount} target={target} color={myDone ? "var(--success)" : "var(--primary)"} />
              <span className="text-[10px] w-[22px] text-right font-medium" style={{ color: myDone ? "var(--success)" : "var(--muted)" }}>{myCount}/{target}</span>
            </div>
            <div className="flex items-center gap-2">
              <MiniAvatar initial={partnerInitial} variant="partner" />
              <ProgressBar4 count={partnerCount} target={target} color={partnerDone ? "var(--success)" : "var(--partner-accent)"} />
              <span className="text-[10px] w-[22px] text-right font-medium" style={{ color: partnerDone ? "var(--success)" : "var(--muted)" }}>{partnerCount}/{target}</span>
            </div>
          </div>
        )
      )}

      {!isShared && goal.cadence !== "once" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <ProgressBar count={count} target={target} color={barColor} />
            <span className="text-[10px] text-[--muted] w-[22px] text-right">{count}/{target}</span>
          </div>
          <div className="flex items-center justify-between">
            <WeekBar completions={goal.completions} userId={isOwn ? userId : partnerId} color={barColor} />
            <span className="text-[10px] text-[--muted]">{cadencePeriodLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const { user } = useAuth();
  const { partner, self, loading: coupleLoading, goals, goalsLoading } = useAppData();
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

  const filtered = goals.filter(g => {
    if (filter === "mine") return g.owner_id === user?.id;
    if (filter === "shared") return g.owner_id === null;
    if (filter === "partner") return g.owner_id === partner?.id;
    return true;
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "mine", label: "Mine" },
    { key: "shared", label: "Shared" },
    { key: "partner", label: partner?.display_name.split(" ")[0] ?? "Partner" },
  ];

  const grouped = CADENCE_ORDER
    .map(cad => ({ cadence: cad, goals: filtered.filter(g => g.cadence === cad) }))
    .filter(g => g.goals.length > 0);

  const selfInitial = getInitial(self?.display_name ?? "Y");
  const partnerInitial = getInitial(partner?.display_name ?? "P");

  return (
    <div className="flex flex-col px-4 pt-14 pb-4">
      <div className="flex items-center justify-between px-1 mb-0">
        <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground]">Goals</h1>
        <Link
          href="/goals/new"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[--primary] text-white active:scale-95 transition-transform duration-150"
        >
          <Plus size={18} />
        </Link>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-3 px-1">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors duration-150 border",
              filter === key
                ? "bg-[--primary] text-white border-[--primary]"
                : "bg-transparent text-[--muted] border-[--border]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <p className="text-[--muted] text-sm">No goals here yet.</p>
          <Link href="/goals/new" className="text-[--primary] font-semibold text-sm">Add one</Link>
        </div>
      ) : (
        <div>
          {grouped.map(group => (
            <div key={group.cadence}>
              <CadenceHeader cadence={group.cadence} />
              <div className="flex flex-col gap-2">
                {group.goals.map(g => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    userId={user!.id}
                    partnerId={partner?.id ?? ""}
                    partnerName={partner?.display_name ?? "Partner"}
                    selfInitial={selfInitial}
                    partnerInitial={partnerInitial}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
