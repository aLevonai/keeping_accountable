import { createClient } from "npm:@supabase/supabase-js@2";
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
} from "npm:date-fns@4";
import { TZDate } from "npm:@date-fns/tz@1";

type Cadence = "daily" | "weekly" | "monthly" | "yearly" | "once";

interface ReminderRow {
  id: string;
  goal_id: string;
  user_id: string;
  hour: number;
  minute: number;
  day_of_week: number | null;
  timezone: string;
  goals: {
    id: string;
    title: string;
    cadence: Cadence;
    cadence_target: number;
    owner_id: string | null;
    is_joint: boolean;
  };
}

// The cron runs every 30 minutes; a reminder is due if its time falls in the
// window since the previous run. (Matching the exact minute skipped reminders
// whenever a run started a minute late.)
const WINDOW_MIN = 30;

// Period boundaries in the *user's* timezone — the function itself runs in
// UTC, which put late-night check-ins in the wrong day/week.
function getPeriodRange(cadence: Cadence, now: Date, tz: string): { start: Date; end: Date } | null {
  const d = new TZDate(now, tz);
  switch (cadence) {
    case "daily":   return { start: startOfDay(d), end: endOfDay(d) };
    case "weekly":  return { start: startOfWeek(d, { weekStartsOn: 0 }), end: endOfWeek(d, { weekStartsOn: 0 }) };
    case "monthly": return { start: startOfMonth(d), end: endOfMonth(d) };
    case "yearly":  return { start: startOfYear(d), end: endOfYear(d) };
    case "once":    return null;
  }
}

const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localClock(now: Date, tz: string): { minutes: number; dow: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const hour = parseInt(parts.hour ?? "0") % 24; // "24" at midnight in some engines
  return { minutes: hour * 60 + parseInt(parts.minute ?? "0"), dow: dayMap[parts.weekday ?? ""] ?? 0 };
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: rows } = await supabase
    .from("goal_reminders")
    .select(`
      id, goal_id, user_id, hour, minute, day_of_week, timezone,
      goals!inner ( id, title, cadence, cadence_target, owner_id, is_joint )
    `)
    .eq("enabled", true)
    .is("goals.archived_at", null);

  const reminders = (rows ?? []) as unknown as ReminderRow[];
  const now = new Date();
  let sent = 0, skipped = 0;

  for (const r of reminders) {
    const tz = r.timezone || "UTC";
    const { minutes, dow } = localClock(now, tz);
    const slot = r.hour * 60 + r.minute;
    const sinceSlot = (minutes - slot + 1440) % 1440;
    if (sinceSlot >= WINDOW_MIN) { skipped++; continue; }
    if (r.goals.cadence === "weekly" && r.day_of_week != null && dow !== r.day_of_week) { skipped++; continue; }

    const range = getPeriodRange(r.goals.cadence, now, tz);
    let q = supabase
      .from("completions")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", r.goal_id);
    if (range) {
      // Plain UTC ISO strings (TZDate.toISOString keeps the local offset).
      q = q
        .gte("completed_at", new Date(range.start.getTime()).toISOString())
        .lte("completed_at", new Date(range.end.getTime()).toISOString());
    }
    // Joint shared goals count everyone's check-ins; otherwise only yours.
    if (!(r.goals.owner_id === null && r.goals.is_joint)) {
      q = q.eq("user_id", r.user_id);
    }
    const { count } = await q;
    const target = r.goals.cadence === "once" ? 1 : r.goals.cadence_target;
    if ((count ?? 0) >= target) { skipped++; continue; }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: r.user_id,
          title: "Don't forget",
          body: `You haven't checked in on "${r.goals.title}" yet`,
          url: `/check-in/${r.goal_id}`,
          tag: `reminder-${r.goal_id}`,
        }),
      });
      if (res.ok) sent++; else skipped++;
    } catch {
      skipped++;
    }
  }

  return new Response(JSON.stringify({ ok: true, checked: reminders.length, sent, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
