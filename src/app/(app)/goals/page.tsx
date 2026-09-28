"use client";

import { useAppData } from "@/contexts/app-data";
import Link from "next/link";
import { Plus, Check } from "lucide-react";
import { goalProgress, goalStreak, cadenceUnit } from "@/utils/goal-progress";
import type { GoalWithCompletions } from "@/types/database";
import { GoalsSkeleton } from "@/components/ui/page-skeleton";
import { Avatar, Dots, SectionDivider, PageTitle, firstName } from "@/components/ui/bits";
import { CheckInButton } from "@/components/check-in-button";
import { usePrefetchGoalHistory } from "@/hooks/use-goal";

const CADENCE_LABEL: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
  once: "one-time",
};

function GoalCard({
  goal,
  userId,
  partnerId,
  selfName,
  partnerName,
  inDoneSection,
}: {
  goal: GoalWithCompletions;
  userId: string;
  partnerId?: string;
  selfName?: string;
  partnerName?: string;
  inDoneSection: boolean;
}) {
  const p = goalProgress(goal, userId, partnerId);
  const prefetchHistory = usePrefetchGoalHistory();
  const canCheckIn = !p.isPartners;
  const chipColor = goal.color ?? "#374151";
  const done = inDoneSection || p.done;
  const streak = goalStreak(goal, userId);

  const cardBg = done ? "var(--surface)" : `color-mix(in srgb, ${chipColor} 5%, transparent)`;
  const cardBorder = done ? "var(--border)" : `color-mix(in srgb, ${chipColor} 19%, transparent)`;
  const opacity = p.isPartners ? 0.8 : inDoneSection ? 0.6 : 1;

  return (
    <div
      className="relative rounded-[14px] border p-3.5 flex flex-col gap-2.5"
      style={{ background: cardBg, borderColor: cardBorder, opacity }}
    >
      {/* Whole card opens the goal; the + button sits above this link. */}
      <Link
        href={`/goals/${goal.id}`}
        onPointerDown={() => prefetchHistory(goal.id)}
        className="absolute inset-0 rounded-[14px] active:bg-black/[0.03]"
        aria-label={`Open ${goal.title}`}
      />

      <div className="flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-[3px]" style={{ width: 11, height: 11, borderRadius: 3, background: chipColor }} />
          <div className="flex-1 min-w-0">
            <span className="text-[14px] font-medium block truncate" style={{ color: done ? "var(--muted)" : "var(--foreground)" }}>
              {goal.title}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-muted">{CADENCE_LABEL[goal.cadence] ?? goal.cadence}</span>
              {p.isShared && (
                <>
                  <span className="text-[10px] text-muted">·</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-primary">Together</span>
                </>
              )}
            </div>
          </div>
        </div>

        {canCheckIn ? (
          <div className="flex items-center gap-1 flex-shrink-0 pointer-events-auto relative">
            {p.myDone && !inDoneSection && (
              <div className="w-[20px] h-[20px] rounded-full bg-success-light flex items-center justify-center flex-shrink-0">
                <Check size={9} className="text-success" />
              </div>
            )}
            <CheckInButton goal={goal} subdued={inDoneSection || p.myDone} />
          </div>
        ) : done ? (
          <div className="w-[26px] h-[26px] rounded-full bg-success-light flex items-center justify-center flex-shrink-0">
            <Check size={12} className="text-success" />
          </div>
        ) : null}
      </div>

      {goal.cadence !== "once" && (
        <div className="pointer-events-none">
          {p.mode === "separate" ? (
            <div className="flex flex-col gap-1.5 pl-[19px]">
              <div className="flex items-center gap-1.5">
                <Avatar name={selfName} who="self" size={14} color={chipColor} />
                <Dots count={p.myCount} target={p.target} color={p.myDone ? "var(--success)" : chipColor} />
                {p.myDone && <Check size={10} className="text-success flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-1.5">
                <Avatar name={partnerName} who="partner" size={14} />
                <Dots
                  count={p.partnerCount}
                  target={p.target}
                  color={p.partnerCount >= p.target ? "var(--success)" : "var(--partner-accent)"}
                />
                {p.partnerCount >= p.target && <Check size={10} className="text-success flex-shrink-0" />}
              </div>
            </div>
          ) : (
            <div className="pl-[19px]">
              <Dots
                count={p.total}
                target={p.target}
                color={done ? "var(--success)" : p.isPartners ? "var(--partner-accent)" : chipColor}
              />
            </div>
          )}
        </div>
      )}

      {streak >= 2 && goal.cadence !== "once" && (
        <div className="pl-[19px] flex items-center gap-1.5 pointer-events-none">
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: done ? "var(--success)" : chipColor, flexShrink: 0 }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: done ? "var(--success)" : chipColor }}>
            {streak} {cadenceUnit(goal.cadence)} streak
          </span>
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const { user, partner, self, loading, goals, goalsLoading } = useAppData();

  if (loading || goalsLoading || !user) {
    return (
      <div className="flex flex-col px-5 pt-14 gap-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-16 bg-border rounded-xl animate-pulse" />
          <div className="w-9 h-9 rounded-full bg-border animate-pulse" />
        </div>
        <GoalsSkeleton />
      </div>
    );
  }

  const isDone = (g: GoalWithCompletions) => goalProgress(g, user.id, partner?.id).done;
  const mine = goals.filter((g) => g.owner_id === user.id);
  const shared = goals.filter((g) => g.owner_id === null);
  const partners = partner ? goals.filter((g) => g.owner_id === partner.id) : [];

  const sections = [
    { label: "Yours", items: mine.filter((g) => !isDone(g)) },
    { label: "Together", items: shared.filter((g) => !isDone(g)) },
    { label: `${firstName(partner?.display_name, "Partner")}'s`, items: partners.filter((g) => !isDone(g)) },
  ];
  const allDone = [...mine, ...shared, ...partners].filter(isDone);

  const cardProps = {
    userId: user.id,
    partnerId: partner?.id,
    selfName: self?.display_name,
    partnerName: partner?.display_name,
  };

  return (
    <div className="flex flex-col px-4 pt-14 pb-4">
      <div className="flex items-center justify-between px-1">
        <PageTitle>Goals</PageTitle>
        <Link
          href="/goals/new"
          aria-label="New goal"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white active:scale-95 transition-transform duration-150"
        >
          <Plus size={18} />
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <p className="text-muted text-sm">No goals yet.</p>
          <Link href="/goals/new" className="text-primary font-semibold text-sm">Add one</Link>
        </div>
      ) : (
        <div>
          {sections.map(
            (s) =>
              s.items.length > 0 && (
                <div key={s.label}>
                  <SectionDivider label={s.label} count={s.items.length} />
                  <div className="flex flex-col gap-2">
                    {s.items.map((g) => (
                      <GoalCard key={g.id} goal={g} inDoneSection={false} {...cardProps} />
                    ))}
                  </div>
                </div>
              )
          )}

          {allDone.length > 0 && (
            <>
              <SectionDivider label="Done ✓" count={allDone.length} />
              <div className="flex flex-col gap-2">
                {allDone.map((g) => (
                  <GoalCard key={g.id} goal={g} inDoneSection {...cardProps} />
                ))}
              </div>
            </>
          )}

          <p className="text-[11px] text-muted text-center mt-6">Tip: press and hold + to log without a photo</p>
        </div>
      )}
    </div>
  );
}
