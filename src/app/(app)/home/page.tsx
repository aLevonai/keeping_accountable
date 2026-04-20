"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";
import { useGoals } from "@/hooks/use-goals";
import { countCompletionsInPeriod, getPeriodRange } from "@/utils/period";
import { startOfWeek, addDays, isSameDay } from "date-fns";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import type { Cadence } from "@/types/database";

// Mon–Sun labels
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function WeekDots({ completions }: { completions: { completed_at: string }[] }) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  return (
    <div className="flex gap-1">
      {WEEKDAYS.map((label, i) => {
        const day = addDays(weekStart, i);
        const filled = completions.some((c) => isSameDay(new Date(c.completed_at), day));
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div className={`w-5 h-5 rounded-full border ${filled ? "bg-black border-black" : "border-gray-300"}`} />
            <span className="text-[9px] text-gray-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function GoalRow({ goal, userId }: { goal: GoalWithCompletions; userId: string }) {
  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const done = goal.cadence === "once" ? count >= 1 : count >= target;
  const isShared = goal.owner_id === null;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100">
      {/* Goal info */}
      <Link href={`/goals/${goal.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm text-gray-900 truncate">{goal.title}</span>
          {isShared && <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1">shared</span>}
          {!isShared && goal.owner_id !== userId && <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1">partner</span>}
        </div>
        <div className="mt-1.5">
          {goal.cadence === "weekly" ? (
            <WeekDots completions={goal.completions} />
          ) : (
            <span className="text-xs text-gray-500">
              {goal.cadence === "once"
                ? done ? "Done ✓" : "Not done"
                : `${count} / ${target} this ${goal.cadence}`}
            </span>
          )}
        </div>
      </Link>

      {/* Count badge for weekly */}
      {goal.cadence === "weekly" && (
        <span className="text-xs text-gray-500 w-8 text-right">{count}/{target}</span>
      )}

      {/* Check-in button */}
      {(isShared || goal.owner_id === userId) && !done && (
        <Link
          href={`/check-in/${goal.id}`}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-full text-gray-500 text-lg leading-none hover:bg-gray-50 active:scale-95 transition-transform flex-shrink-0"
        >
          +
        </Link>
      )}
      {done && (
        <span className="w-8 h-8 flex items-center justify-center text-base">✓</span>
      )}
    </div>
  );
}

function onTrackCount(goals: GoalWithCompletions[], userId: string): { onTrack: number; total: number } {
  const mine = goals.filter((g) => g.owner_id === null || g.owner_id === userId);
  const onTrack = mine.filter((g) => {
    const count = countCompletionsInPeriod(g.completions, g.cadence);
    return count >= g.cadence_target;
  });
  return { onTrack: onTrack.length, total: mine.length };
}

export default function HomePage() {
  const { user } = useAuth();
  const { couple, partner, self, loading: coupleLoading } = useCouple(user?.id);
  const { goals, loading: goalsLoading } = useGoals(couple?.id);

  const loading = coupleLoading || goalsLoading;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>;
  }

  if (!couple) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-3 text-center">
        <p className="font-semibold text-gray-900">Waiting for your partner</p>
        <p className="text-sm text-gray-500">Share your invite code from the Profile tab so they can join.</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const { onTrack, total } = onTrackCount(goals, user!.id);

  const sharedGoals = goals.filter((g) => g.owner_id === null);
  const myGoals = goals.filter((g) => g.owner_id === user?.id);
  const partnerGoals = goals.filter((g) => g.owner_id === partner?.id);

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{today}</p>
        <h1 className="text-xl font-bold text-gray-900 mt-0.5">
          {self?.display_name} & {partner?.display_name ?? "partner"}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {total === 0 ? "No goals yet" : `${onTrack} of ${total} goals on track`}
        </p>
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-gray-500 text-sm">No goals yet.</p>
          <Link href="/goals/new" className="text-sm font-medium underline text-gray-700">Add your first goal</Link>
        </div>
      ) : (
        <>
          {sharedGoals.length > 0 && (
            <section className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Together</p>
              {sharedGoals.map((g) => <GoalRow key={g.id} goal={g} userId={user!.id} />)}
            </section>
          )}
          {myGoals.length > 0 && (
            <section className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">You</p>
              {myGoals.map((g) => <GoalRow key={g.id} goal={g} userId={user!.id} />)}
            </section>
          )}
          {partnerGoals.length > 0 && (
            <section className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{partner?.display_name}</p>
              {partnerGoals.map((g) => <GoalRow key={g.id} goal={g} userId={user!.id} />)}
            </section>
          )}
        </>
      )}

      <div className="mt-4">
        <Link href="/goals/new" className="text-sm font-medium text-gray-700 underline">+ New goal</Link>
      </div>
    </div>
  );
}
