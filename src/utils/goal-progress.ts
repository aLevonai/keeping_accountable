import type { GoalWithCompletions, CompletionLite } from "@/types/database";
import { countCompletionsInPeriod, calculateStreak } from "@/utils/period";

// How a goal's check-ins are counted:
//  personal — one owner, their check-ins count
//  joint    — shared, both people's check-ins add up to one total
//  separate — shared, each person tracks their own count against the target
export type ProgressMode = "personal" | "joint" | "separate";

export interface GoalProgress {
  mode: ProgressMode;
  target: number;
  /** Count shown as "yours": your own for separate goals, the shared total for joint. */
  myCount: number;
  /** Partner's own count (separate goals) or the owner's count for partner goals. */
  partnerCount: number;
  /** Everyone's check-ins this period. */
  total: number;
  /** You've met your part of the target. */
  myDone: boolean;
  /** The goal as a whole is complete this period. */
  done: boolean;
  isMine: boolean;
  isPartners: boolean;
  isShared: boolean;
}

export function goalMode(goal: Pick<GoalWithCompletions, "owner_id" | "is_joint">): ProgressMode {
  if (goal.owner_id !== null) return "personal";
  return goal.is_joint ? "joint" : "separate";
}

export function goalProgress(
  goal: GoalWithCompletions,
  userId: string | undefined,
  partnerId: string | undefined
): GoalProgress {
  const mode = goalMode(goal);
  const target = goal.cadence === "once" ? 1 : goal.cadence_target;
  const count = (list: CompletionLite[]) => countCompletionsInPeriod(list, goal.cadence);

  const total = count(goal.completions);
  const mine = count(goal.completions.filter((c) => c.user_id === userId));
  const partners = count(goal.completions.filter((c) => c.user_id === partnerId));

  const isMine = goal.owner_id !== null && goal.owner_id === userId;
  const isPartners = goal.owner_id !== null && goal.owner_id === partnerId;

  const myCount = mode === "separate" ? mine : total;
  const partnerCount = mode === "separate" ? partners : total;
  const myDone = myCount >= target;
  const done = mode === "separate" ? mine >= target && partners >= target : total >= target;

  return {
    mode,
    target,
    myCount,
    partnerCount,
    total,
    myDone,
    done,
    isMine,
    isPartners,
    isShared: goal.owner_id === null,
  };
}

// Streaks follow the same rules: separate goals track your own run.
export function goalStreak(goal: GoalWithCompletions, userId: string | undefined): number {
  const comps =
    goalMode(goal) === "separate"
      ? goal.completions.filter((c) => c.user_id === userId)
      : goal.completions;
  return calculateStreak(comps, goal.cadence, goal.cadence === "once" ? 1 : goal.cadence_target);
}

export function cadenceUnit(cadence: GoalWithCompletions["cadence"]): string {
  switch (cadence) {
    case "daily": return "day";
    case "weekly": return "week";
    case "monthly": return "month";
    case "yearly": return "year";
    case "once": return "";
  }
}
