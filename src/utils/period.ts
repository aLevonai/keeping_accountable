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
