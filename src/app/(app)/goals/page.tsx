"use client";

import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { countCompletionsInPeriod, calculateStreak } from "@/utils/period";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import { GoalsSkeleton } from "@/components/ui/page-skeleton";

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function Dots({ count, target, color, size = 6 }: {
  count: number;
  target: number;
  color: string;
  size?: number;
}) {
  const max = Math.min(target, 8);
  return (
    <div className="flex gap-[3px] items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: i < count ? color : "transparent",
            border: `1.5px solid ${i < count ? color : "var(--border)"}`,
            flexShrink: 0,
          }}
        />
      ))}
      {(target > 8 || count > target) && (
        <span style={{ color, fontSize: 9, marginLeft: 2 }}>{count}/{target}</span>
      )}
    </div>
  );
}

function SectionDivider({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2.5">
      <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[--muted] whitespace-nowrap">
        {label}
      </span>
      {count != null && (
        <span className="text-[9px] font-semibold text-[--muted] bg-[--border] rounded-full px-1.5 py-px">
          {count}
        </span>
      )}
      <div className="flex-1 h-px bg-[--border]" />
    </div>
  );
}

const CADENCE_LABEL: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
  once: "one-time",
};

function GoalCardFocus({
  goal,
  userId,
  partnerId,
  partnerName,
  selfInitial,
  partnerInitial,
  variant = "self",
}: {
  goal: GoalWithCompletions;
  userId: string;
  partnerId: string;
  partnerName: string;
  selfInitial: string;
  partnerInitial: string;
  variant?: "self" | "shared" | "partner" | "done";
}) {
  const router = useRouter();
  const isShared = goal.owner_id === null;
  const isPartner = goal.owner_id === partnerId;
  const isDone = variant === "done";

  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;

  const myCount = isShared
    ? countCompletionsInPeriod(goal.completions.filter(c => c.user_id === userId), goal.cadence)
    : count;
  const partnerCount = isShared
    ? countCompletionsInPeriod(goal.completions.filter(c => c.user_id === partnerId), goal.cadence)
    : 0;
  const myDone = myCount >= target;
  const partnerDone = partnerCount >= target;

  // For non-joint shared: only "done" when BOTH people have hit their individual target
  const overallDone = goal.cadence === "once"
    ? (isShared && !goal.is_joint ? myCount >= 1 && partnerCount >= 1 : count >= 1)
    : (isShared && !goal.is_joint ? myDone && partnerDone : count >= target);
  const done = isDone || overallDone;

  // Whether the current user has personally met their target
  const isUserDone = isShared && !goal.is_joint ? myDone : overallDone;

  // User can check in (not a partner-only goal) — always true for own/shared goals, enables extras
  const canCheckIn = !isPartner;
  const isExtra = canCheckIn && (isDone || isUserDone);

  const chipColor = goal.color ?? "#374151";
  const cadenceLabel = CADENCE_LABEL[goal.cadence] ?? goal.cadence;

  const streakComps = isShared && !goal.is_joint
    ? goal.completions.filter(c => c.user_id === userId)
    : goal.completions;
  const streak = calculateStreak(streakComps, goal.cadence, target);

  const cardBg = done ? "var(--surface)" : chipColor + "0d";
  const cardBorder = done ? "var(--border)" : chipColor + "30";
  const opacity = isPartner ? 0.78 : isDone ? 0.55 : 1;

  return (
    <div
      onClick={() => router.push(`/goals/${goal.id}`)}
      className="rounded-[14px] border p-3.5 flex flex-col gap-2.5 active:scale-[0.98] transition-transform duration-150 cursor-pointer"
      style={{ background: cardBg, borderColor: cardBorder, opacity }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* Color chip */}
          <div
            className="flex-shrink-0 mt-[3px]"
            style={{
              width: 11,
              height: 11,
              borderRadius: 3,
              background: chipColor,
            }}
          />
          <div className="flex-1 min-w-0">
            <span
              className="text-[14px] font-medium block truncate"
              style={{ color: done ? "var(--muted)" : "var(--foreground)" }}
            >
              {goal.title}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-[--muted]">{cadenceLabel}</span>
              {isShared && (
                <>
                  <span className="text-[10px] text-[--muted]">·</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[--primary]">Together</span>
                </>
              )}
            </div>
          </div>
        </div>

        {canCheckIn ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            {isUserDone && !isDone && (
              <div className="w-[20px] h-[20px] rounded-full bg-[--success-light] flex items-center justify-center flex-shrink-0">
                <Check size={9} className="text-[--success]" />
              </div>
            )}
            <Link
              href={`/check-in/${goal.id}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center justify-center rounded-full font-semibold text-[18px] leading-none active:scale-95 transition-transform flex-shrink-0"
              style={{
                width: 26,
                height: 26,
                background: isExtra ? "transparent" : chipColor + "25",
                border: isExtra ? "1.5px dashed var(--border)" : `1px solid ${chipColor}55`,
                color: isExtra ? "var(--muted)" : chipColor,
              }}
            >+</Link>
          </div>
        ) : done ? (
          <div className="w-[26px] h-[26px] rounded-full bg-[--success-light] flex items-center justify-center flex-shrink-0">
            <Check size={12} className="text-[--success]" />
          </div>
        ) : null}
      </div>

      {/* Progress dots */}
      {goal.cadence !== "once" && (
        isShared && !goal.is_joint ? (
          <div className="flex flex-col gap-1.5 pl-[19px]">
            <div className="flex items-center gap-1.5">
              <div
                className="w-[14px] h-[14px] rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0"
                style={{ background: chipColor + "20", color: chipColor, border: `1px solid ${chipColor}40` }}
              >
                {selfInitial}
              </div>
              <Dots count={myCount} target={target} color={myDone ? "var(--success)" : chipColor} />
              {myDone && <Check size={10} className="text-[--success] flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-[14px] h-[14px] rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0"
                style={{ background: "var(--partner-light)", color: "var(--partner-accent)", border: "1px solid rgba(74,122,155,0.4)" }}
              >
                {partnerInitial}
              </div>
              <Dots count={partnerCount} target={target} color={partnerDone ? "var(--success)" : "var(--partner-accent)"} />
              {partnerDone && <Check size={10} className="text-[--success] flex-shrink-0" />}
            </div>
          </div>
        ) : (
          <div className="pl-[19px]">
            <Dots
              count={isShared && goal.is_joint ? count : (isPartner ? count : myCount)}
              target={target}
              color={done ? "var(--success)" : isPartner ? "var(--partner-accent)" : chipColor}
            />
          </div>
        )
      )}

      {/* Streak badge */}
      {streak >= 2 && goal.cadence !== "once" && (
        <div className="pl-[19px] flex items-center gap-1.5">
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: done ? "var(--success)" : chipColor, flexShrink: 0 }} />
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: done ? "var(--success)" : chipColor }}
          >
            {streak} {goal.cadence === "daily" ? "day" : goal.cadence === "weekly" ? "week" : goal.cadence === "monthly" ? "month" : "year"} streak
          </span>
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const { user } = useAuth();
  const { partner, self, loading: coupleLoading, goals, goalsLoading } = useAppData();
  const loading = !user || coupleLoading || goalsLoading;

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

  const myGoals = goals.filter(g => g.owner_id === user?.id);
  const sharedGoals = goals.filter(g => g.owner_id === null);
  const partnerGoals = goals.filter(g => g.owner_id === partner?.id);

  const isDoneGoal = (g: GoalWithCompletions): boolean => {
    if (g.owner_id === null && !g.is_joint) {
      const myC = countCompletionsInPeriod(g.completions.filter(c => c.user_id === user!.id), g.cadence);
      const partnerC = partner
        ? countCompletionsInPeriod(g.completions.filter(c => c.user_id === partner.id), g.cadence)
        : 0;
      return g.cadence === "once"
        ? myC >= 1 && partnerC >= 1
        : myC >= g.cadence_target && partnerC >= g.cadence_target;
    }
    const count = countCompletionsInPeriod(g.completions, g.cadence);
    return g.cadence === "once" ? count >= 1 : count >= g.cadence_target;
  };

  const myActive = myGoals.filter(g => !isDoneGoal(g));
  const myDone = myGoals.filter(g => isDoneGoal(g));
  const sharedActive = sharedGoals.filter(g => !isDoneGoal(g));
  const sharedDone = sharedGoals.filter(g => isDoneGoal(g));
  const partnerActive = partnerGoals.filter(g => !isDoneGoal(g));
  const partnerDone = partnerGoals.filter(g => isDoneGoal(g));

  const allDone = [...myDone, ...sharedDone, ...partnerDone];
  const hasAnyActive = myActive.length + sharedActive.length + partnerActive.length > 0;

  const selfInitial = getInitial(self?.display_name ?? "Y");
  const partnerInitial = getInitial(partner?.display_name ?? "P");
  const partnerFirstName = partner?.display_name.split(" ")[0] ?? "Partner";

  const commonProps = {
    userId: user!.id,
    partnerId: partner?.id ?? "",
    partnerName: partner?.display_name ?? "Partner",
    selfInitial,
    partnerInitial,
  };

  return (
    <div className="flex flex-col px-4 pt-14 pb-4">
      <div className="flex items-center justify-between px-1 mb-0">
        <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground]">Goals</h1>
        <Link
          href="/goals/new"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white active:scale-95 transition-transform duration-150"
        >
          <Plus size={18} />
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <p className="text-[--muted] text-sm">No goals yet.</p>
          <Link href="/goals/new" className="text-[--primary] font-semibold text-sm">Add one</Link>
        </div>
      ) : (
        <div>
          {/* Yours */}
          {myActive.length > 0 && (
            <>
              <SectionDivider label="Yours" count={myActive.length} />
              <div className="flex flex-col gap-2">
                {myActive.map(g => (
                  <GoalCardFocus key={g.id} goal={g} variant="self" {...commonProps} />
                ))}
              </div>
            </>
          )}

          {/* Together */}
          {sharedActive.length > 0 && (
            <>
              <SectionDivider label="Together" count={sharedActive.length} />
              <div className="flex flex-col gap-2">
                {sharedActive.map(g => (
                  <GoalCardFocus key={g.id} goal={g} variant="shared" {...commonProps} />
                ))}
              </div>
            </>
          )}

          {/* Partner */}
          {partnerActive.length > 0 && (
            <>
              <SectionDivider label={`${partnerFirstName}'s`} count={partnerActive.length} />
              <div className="flex flex-col gap-2">
                {partnerActive.map(g => (
                  <GoalCardFocus key={g.id} goal={g} variant="partner" {...commonProps} />
                ))}
              </div>
            </>
          )}

          {/* Done */}
          {allDone.length > 0 && (hasAnyActive || allDone.length > 0) && (
            <>
              <SectionDivider label="Done ✓" count={allDone.length} />
              <div className="flex flex-col gap-2">
                {allDone.map(g => (
                  <GoalCardFocus key={g.id} goal={g} variant="done" {...commonProps} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
