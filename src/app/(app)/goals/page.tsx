"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useAppData } from "@/contexts/app-data";
import { usePrefetchGoalHistory } from "@/hooks/use-goal";
import { goalProgress, goalStreak, cadenceUnit } from "@/utils/goal-progress";
import { getPeriodLabel } from "@/utils/period";
import { seeded, between } from "@/utils/seeded";
import type { GoalWithCompletions } from "@/types/database";
import { GoalsSkeleton } from "@/components/ui/page-skeleton";
import { Avatar, firstName } from "@/components/ui/bits";
import { PaperPage, PaperHeader, HandHeading, Tapes, Pin, Punches, InkStamp } from "@/components/ui/paper";
import { CheckInButton } from "@/components/check-in-button";

// Goals as index cards: taped or pinned to the page, progress punched through
// the card, and a green DONE stamp once the period's target is hit.

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
}: {
  goal: GoalWithCompletions;
  userId: string;
  partnerId?: string;
  selfName?: string;
  partnerName?: string;
}) {
  const p = goalProgress(goal, userId, partnerId);
  const prefetchHistory = usePrefetchGoalHistory();
  const streak = goalStreak(goal, userId);
  const r = seeded(goal.id + ":card");
  const tilt = between(r, -1.3, 1.3);
  const ink = p.isPartners ? "var(--partner-accent)" : "var(--primary)";
  const mode = p.mode === "joint" ? " · together" : p.mode === "separate" ? " · each of us" : "";
  const left = Math.max(0, p.target - (p.mode === "separate" ? p.myCount : p.total));

  return (
    <div className="relative mx-5 mb-6" style={{ transform: `rotate(${tilt}deg)` }}>
      <div
        className="relative shadow-[0_2px_5px_rgba(60,40,20,0.12),0_12px_20px_-14px_rgba(60,40,20,0.35)]"
        style={{
          // Index card: red header rule, faint blue lines below.
          background: p.isPartners
            ? "linear-gradient(#F4F8FB 0 46px, rgba(74,122,155,0.35) 46px 47px, #F4F8FB 47px)"
            : "linear-gradient(#FFFDF8 0 46px, rgba(214,120,120,0.45) 46px 47px, transparent 47px), repeating-linear-gradient(#FFFDF8 0 23px, rgba(120,160,200,0.22) 23px 24px)",
          backgroundColor: p.isPartners ? "#F4F8FB" : "#FFFDF8",
        }}
      >
        {p.isPartners ? <Pin color="var(--partner-accent)" className="-top-1 left-1/2 -translate-x-1/2" /> : <Tapes r={r} />}

        {/* Whole card opens the goal; the + button sits above this link. */}
        <Link
          href={`/goals/${goal.id}`}
          onPointerDown={() => prefetchHistory(goal.id)}
          className="absolute inset-0 active:bg-black/[0.03]"
          aria-label={`Open ${goal.title}`}
        />

        <div className="px-4 pt-3 pb-3.5 pointer-events-none">
          <div className="flex items-start gap-3 h-[40px]">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted truncate">
                {CADENCE_LABEL[goal.cadence] ?? goal.cadence}{mode}
              </p>
              <p
                className={`text-[16px] font-medium truncate mt-0.5 ${p.done ? "text-muted" : "text-foreground"}`}
                dir="auto"
              >
                {goal.title}
              </p>
            </div>
            {!p.isPartners && (
              <div className="pointer-events-auto relative flex-shrink-0">
                <CheckInButton goal={goal} subdued={p.myDone} size={30} />
              </div>
            )}
          </div>

          {goal.cadence !== "once" && (
            <div className="mt-3 flex flex-col gap-2">
              {p.mode === "separate" ? (
                <>
                  <div className="flex items-center gap-2">
                    <Avatar name={selfName} who="self" size={16} />
                    <Punches count={p.myCount} target={p.target} color={p.myDone ? "var(--success)" : "var(--primary)"} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar name={partnerName} who="partner" size={16} />
                    <Punches
                      count={p.partnerCount}
                      target={p.target}
                      color={p.partnerCount >= p.target ? "var(--success)" : "var(--partner-accent)"}
                    />
                  </div>
                </>
              ) : (
                <Punches count={p.total} target={p.target} color={p.done ? "var(--success)" : ink} />
              )}
            </div>
          )}

          <div className="flex items-end justify-between mt-2.5 min-h-[20px]">
            <p className="font-hand text-[17px] leading-none text-[#8A7B6E]">
              {goal.cadence === "once"
                ? p.done ? "done for good" : "whenever you're ready"
                : p.done
                  ? `all ${p.target} ${getPeriodLabel(goal.cadence)}`
                  : `${left} to go ${getPeriodLabel(goal.cadence)}`}
            </p>
            {streak >= 2 && goal.cadence !== "once" && (
              <InkStamp color={p.done ? "var(--success)" : ink} rotate={-4}>
                {streak} {cadenceUnit(goal.cadence)} streak
              </InkStamp>
            )}
          </div>
        </div>

        {p.done && (
          <div className="absolute right-16 top-3 pointer-events-none">
            <InkStamp size="lg" rotate={-14}>Done</InkStamp>
          </div>
        )}
      </div>
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
    { label: "yours", items: mine.filter((g) => !isDone(g)) },
    { label: "together", items: shared.filter((g) => !isDone(g)) },
    { label: `${firstName(partner?.display_name, "partner")}'s`, items: partners.filter((g) => !isDone(g)) },
    { label: "done for now", items: [...mine, ...shared, ...partners].filter(isDone) },
  ];

  const cardProps = {
    userId: user.id,
    partnerId: partner?.id,
    selfName: self?.display_name,
    partnerName: partner?.display_name,
  };

  return (
    <PaperPage>
      <PaperHeader
        title="Goals"
        subtitle="what we're working on"
        action={
          <Link
            href="/goals/new"
            aria-label="New goal"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white shadow-[0_3px_8px_rgba(196,112,79,0.35)] active:scale-95 transition-transform"
          >
            <Plus size={19} />
          </Link>
        }
      />

      {goals.length === 0 ? (
        <div className="flex justify-center pt-16">
          <Link
            href="/goals/new"
            className="relative bg-[#FFF1B8] px-6 pt-7 pb-5 -rotate-2 shadow-[0_14px_18px_-14px_rgba(60,40,20,0.45)] max-w-[240px] text-center"
          >
            <Pin className="top-2 left-1/2 -translate-x-1/2" />
            <p className="font-hand text-[24px] leading-tight text-[#3B332C]">No goals yet.</p>
            <p className="font-hand text-[19px] text-primary mt-1">add the first one →</p>
          </Link>
        </div>
      ) : (
        <>
          {sections.map(
            (s) =>
              s.items.length > 0 && (
                <section key={s.label}>
                  <HandHeading count={s.items.length}>{s.label}</HandHeading>
                  {s.items.map((g) => (
                    <GoalCard key={g.id} goal={g} {...cardProps} />
                  ))}
                </section>
              )
          )}
          <p className="font-hand text-[18px] text-muted text-center mt-4 px-8">
            psst — hold the + to log without a photo
          </p>
        </>
      )}
    </PaperPage>
  );
}
