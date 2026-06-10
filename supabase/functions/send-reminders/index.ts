import { createClient } from "npm:@supabase/supabase-js@2";
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
} from "npm:date-fns@3";

type Cadence = "daily" | "weekly" | "monthly" | "yearly" | "once";

function getPeriodRange(cadence: Cadence, date = new Date()): { start: Date; end: Date } | null {
  switch (cadence) {
    case "daily":   return { start: startOfDay(date),   end: endOfDay(date) };
    case "weekly":  return { start: startOfWeek(date, { weekStartsOn: 0 }), end: endOfWeek(date, { weekStartsOn: 0 }) };
    case "monthly": return { start: startOfMonth(date), end: endOfMonth(date) };
    case "yearly":  return { start: startOfYear(date),  end: endOfYear(date) };
    case "once":    return null;
  }
}

const dayMap: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: rows } = await supabase
    .from("goal_reminders")
    .select(`
      id, goal_id, user_id, hour, minute, day_of_week, timezone,
      goals!inner ( id, title, cadence, cadence_target, owner_id, is_joint ),
      users!inner ( push_token )
    `)
    .eq("enabled", true);

  // deno-lint-ignore no-explicit-any
  const reminders = (rows ?? []) as any[];
  const now = new Date();
  let sent = 0, skipped = 0;

  for (const r of reminders) {
    if (!r.users?.push_token) { skipped++; continue; }

    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: r.timezone,
      hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
    const curHour = parseInt(parts.hour ?? "");
    const curMin  = parseInt(parts.minute ?? "");
    const curDow  = dayMap[parts.weekday ?? ""] ?? 0;

    if (curHour !== r.hour || curMin !== r.minute) { skipped++; continue; }
    if (r.goals.cadence === "weekly" && r.day_of_week != null && curDow !== r.day_of_week) { skipped++; continue; }

    const range = getPeriodRange(r.goals.cadence as Cadence, now);
    let q = supabase.from("completions")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", r.goal_id);
    if (range) {
      q = q.gte("completed_at", range.start.toISOString())
           .lte("completed_at", range.end.toISOString());
    }
    if (!(r.goals.owner_id === null && r.goals.is_joint)) {
      q = q.eq("user_id", r.user_id);
    }
    const { count } = await q;
    const target = r.goals.cadence === "once" ? 1 : r.goals.cadence_target;
    if ((count ?? 0) >= target) { skipped++; continue; }

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_user_id: r.user_id,
          title: "Don't forget",
          body: `You haven't checked in on "${r.goals.title}" yet`,
        }),
      });
      sent++;
    } catch {
      skipped++;
    }
  }

  return new Response(JSON.stringify({ ok: true, checked: reminders.length, sent, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
