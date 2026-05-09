import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPeriodRange } from "@/utils/period";
import type { Cadence } from "@/types/database";

export const dynamic = "force-dynamic";

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
  users: { push_token: string | null };
}

export async function GET(req: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "missing env" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: rows } = await supabase
    .from("goal_reminders")
    .select(`
      id, goal_id, user_id, hour, minute, day_of_week, timezone,
      goals!inner ( id, title, cadence, cadence_target, owner_id, is_joint ),
      users!inner ( push_token )
    `)
    .eq("enabled", true);

  const reminders = (rows ?? []) as unknown as ReminderRow[];

  const now = new Date();
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let sent = 0;
  let skipped = 0;

  for (const r of reminders) {
    if (!r.users.push_token) { skipped++; continue; }

    // Current time in the reminder's timezone
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: r.timezone,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
    const curHour = parseInt(parts.hour ?? "");
    const curMin = parseInt(parts.minute ?? "");
    const curDow = dayMap[parts.weekday ?? ""] ?? 0;

    // Cron runs at :00 and :30, reminders are constrained to those minutes too
    if (curHour !== r.hour || curMin !== r.minute) { skipped++; continue; }
    if (r.goals.cadence === "weekly" && r.day_of_week != null && curDow !== r.day_of_week) {
      skipped++;
      continue;
    }

    // Already done this period?
    const range = getPeriodRange(r.goals.cadence, now);
    let countQuery = supabase
      .from("completions")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", r.goal_id);
    if (range) {
      countQuery = countQuery
        .gte("completed_at", range.start.toISOString())
        .lte("completed_at", range.end.toISOString());
    }
    // Joint shared goals count combined; everything else is per-user
    if (!(r.goals.owner_id === null && r.goals.is_joint)) {
      countQuery = countQuery.eq("user_id", r.user_id);
    }
    const { count } = await countQuery;
    const target = r.goals.cadence === "once" ? 1 : r.goals.cadence_target;
    if ((count ?? 0) >= target) { skipped++; continue; }

    // Fire push via existing send-push Edge Function
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

  return NextResponse.json({ ok: true, checked: reminders.length, sent, skipped });
}
