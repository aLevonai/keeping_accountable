"use client";

import Link from "next/link";
import { ProgressRing } from "@/components/ui/progress-ring";
import { countCompletionsInPeriod, getPeriodLabel } from "@/utils/period";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import { cn } from "@/utils/cn";

interface GoalCardProps {
  goal: GoalWithCompletions;
  userId: string;
  isShared?: boolean;
}

export function GoalCard({ goal, userId, isShared }: GoalCardProps) {
  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const progress = target > 0 ? count / target : 0;
  const done = count >= target;
  const isOwn = goal.owner_id === userId || goal.owner_id === null;
  const label = getPeriodLabel(goal.cadence);

  return (
    <Link
      href={`/goals/${goal.id}`}
      className={cn(
        "flex items-center gap-3 bg-white rounded-3xl px-4 py-4 shadow-sm border active:scale-95 transition-transform",
        done ? "border-green-200" : "border-stone-100"
      )}
    >
      {/* Emoji + color blob */}
      <div
        className="flex items-center justify-center w-12 h-12 rounded-2xl text-2xl flex-shrink-0"
        style={{ backgroundColor: `${goal.color}22` }}
      >
        {goal.emoji}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="font-bold text-stone-900 text-sm truncate">{goal.title}</h3>
          {isShared && (
            <span className="text-[10px] font-semibold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
              Shared
            </span>
          )}
          {!isOwn && (
            <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
              Partner
            </span>
          )}
        </div>
        <p className="text-xs text-stone-500 mt-0.5">
          {goal.cadence === "once"
            ? done ? "Completed! 🎉" : "Not done yet"
            : `${count}/${target} ${label}`}
        </p>
      </div>

      {/* Progress ring */}
      {goal.cadence !== "once" && (
        <ProgressRing
          progress={progress}
          color={done ? "#22c55e" : goal.color}
          trackColor={done ? "#dcfce7" : `${goal.color}22`}
        />
      )}
      {goal.cadence === "once" && done && (
        <span className="text-2xl">✅</span>
      )}
    </Link>
  );
}
