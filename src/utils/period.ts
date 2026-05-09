import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import type { Cadence } from "@/types/database";

export interface PeriodRecord {
  label: string;
  start: Date;
  end: Date;
  met: boolean;
  inProgress: boolean;
}

export function getPeriodRange(cadence: Cadence, date = new Date()): { start: Date; end: Date } | null {
  switch (cadence) {
    case "weekly":
      return {
        start: startOfWeek(date, { weekStartsOn: 0 }),
        end: endOfWeek(date, { weekStartsOn: 0 }),
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

export function getStreakHistory(
  completions: { completed_at: string }[],
  cadence: Cadence,
  target: number,
  count: number
): PeriodRecord[] {
  if (cadence === "once") return [];

  function countInRange(start: Date, end: Date): number {
    return completions.filter(c => {
      const d = new Date(c.completed_at);
      return d >= start && d <= end;
    }).length;
  }

  function periodLabel(start: Date): string {
    switch (cadence) {
      case "weekly":  return format(start, "MMM d");
      case "monthly": return format(start, "MMM yyyy");
      case "yearly":  return format(start, "yyyy");
      default:        return "";
    }
  }

  const currentRange = getPeriodRange(cadence, new Date())!;
  const periods: { start: Date; end: Date; inProgress: boolean }[] = [
    { start: currentRange.start, end: currentRange.end, inProgress: true },
  ];

  let checkDate = new Date(currentRange.start.getTime() - 1);
  for (let i = 1; i < count; i++) {
    const range = getPeriodRange(cadence, checkDate)!;
    periods.push({ start: range.start, end: range.end, inProgress: false });
    checkDate = new Date(range.start.getTime() - 1);
  }

  periods.reverse(); // oldest → newest (left → right in UI)

  return periods.map(p => ({
    label: periodLabel(p.start),
    start: p.start,
    end: p.end,
    met: countInRange(p.start, p.end) >= target,
    inProgress: p.inProgress,
  }));
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
