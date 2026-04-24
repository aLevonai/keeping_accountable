import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import type { Cadence } from "@/types/database";

export function getPeriodRange(cadence: Cadence, date = new Date()): { start: Date; end: Date } | null {
  switch (cadence) {
    case "weekly":
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 }),
      };
    case "monthly":
      return { start: startOfMonth(date), end: endOfMonth(date) };
    case "yearly":
      return { start: startOfYear(date), end: endOfYear(date) };
    case "once":
      return null;
  }
}

export function getPeriodLabel(cadence: Cadence): string {
  switch (cadence) {
    case "weekly": return "this week";
    case "monthly": return "this month";
    case "yearly": return "this year";
    case "once": return "one-time";
  }
}

export function countCompletionsInPeriod(
  completions: { completed_at: string }[],
  cadence: Cadence
): number {
  const range = getPeriodRange(cadence);
  if (!range) return completions.length;

  return completions.filter((c) => {
    const d = new Date(c.completed_at);
    return d >= range.start && d <= range.end;
  }).length;
}

export function calculateStreak(
  completions: { completed_at: string }[],
  cadence: Cadence,
  target: number
): number {
  if (cadence === "once") return 0;

  function countInRange(start: Date, end: Date): number {
    return completions.filter((c) => {
      const d = new Date(c.completed_at);
      return d >= start && d <= end;
    }).length;
  }

  const currentRange = getPeriodRange(cadence, new Date())!;
  let streak = 0;

  // Include current period if target already met
  if (countInRange(currentRange.start, currentRange.end) >= target) {
    streak = 1;
  }

  // Walk backwards through previous periods (subtract 1ms from period start to land in previous period)
  let checkDate = new Date(currentRange.start.getTime() - 1);
  while (streak < 500) {
    const range = getPeriodRange(cadence, checkDate)!;
    if (countInRange(range.start, range.end) >= target) {
      streak++;
      checkDate = new Date(range.start.getTime() - 1);
    } else {
      break;
    }
  }

  return streak;
}
