"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import type { Cadence } from "@/types/database";
import { ArrowLeft, Bell } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

const CADENCES: { value: Cadence; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "once", label: "One-time" },
];

function cadenceUnit(c: Cadence): string {
  switch (c) {
    case "daily":   return "day";
    case "weekly":  return "week";
    case "monthly": return "month";
    case "yearly":  return "year";
    case "once":    return "";
  }
}

export default function EditGoalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { couple } = useAppData();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [target, setTarget] = useState("3");
  const [isShared, setIsShared] = useState(false);
  const [isJoint, setIsJoint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Reminder state — per-user, even on shared goals
  const [remEnabled, setRemEnabled] = useState(false);
  const [remHour12, setRemHour12] = useState(8);
  const [remMinute, setRemMinute] = useState<0 | 30>(0);
  const [remAmpm, setRemAmpm] = useState<"AM" | "PM">("PM");
  const [remDow, setRemDow] = useState<number>(0);

  useEffect(() => {
    if (!id || !user) return;
    Promise.all([
      supabase.from("goals").select("*").eq("id", id).single(),
      supabase.from("goal_reminders").select("*").eq("goal_id", id).eq("user_id", user.id).maybeSingle(),
    ]).then(([{ data: goal }, { data: rem }]) => {
      if (!goal) { setNotFound(true); setFetching(false); return; }
      setTitle(goal.title);
      setCadence(goal.cadence);
      setTarget(String(goal.cadence_target));
      setIsShared(goal.owner_id === null);
      setIsJoint(goal.is_joint ?? false);

      if (rem && rem.enabled) {
        setRemEnabled(true);
        const h24 = rem.hour;
        const ampm = h24 >= 12 ? "PM" : "AM";
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        setRemHour12(h12);
        setRemAmpm(ampm);
        setRemMinute(rem.minute === 30 ? 30 : 0);
        if (rem.day_of_week != null) setRemDow(rem.day_of_week);
      }
      setFetching(false);
    });
  }, [id, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!couple || !user) return;
    setLoading(true);

    await supabase
      .from("goals")
      .update({
        title: title.trim(),
        cadence,
        cadence_target: cadence === "once" ? 1 : parseInt(target) || 1,
        owner_id: isShared ? null : user.id,
        is_joint: isShared ? isJoint : false,
      })
      .eq("id", id);

    // Save / clear the user's personal reminder for this goal
    if (cadence === "once") {
      // Reminders don't make sense for one-time goals — clear any
      await supabase.from("goal_reminders").delete().eq("goal_id", id).eq("user_id", user.id);
    } else if (remEnabled) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const hour24 = (remHour12 % 12) + (remAmpm === "PM" ? 12 : 0);
      await supabase.from("goal_reminders").upsert({
        goal_id: id,
        user_id: user.id,
        enabled: true,
        hour: hour24,
        minute: remMinute,
        day_of_week: cadence === "weekly" ? remDow : null,
        timezone: tz,
      }, { onConflict: "goal_id,user_id" });
    } else {
      await supabase.from("goal_reminders").delete().eq("goal_id", id).eq("user_id", user.id);
    }

    router.push(`/goals/${id}`);
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[--muted] text-sm">Loading...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-6 text-center">
        <p className="text-[--muted] text-sm">Goal not found.</p>
        <button onClick={() => router.push("/goals")} className="text-sm text-[--primary] font-semibold underline">Back to goals</button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 pb-8 min-h-screen bg-[--background]">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[14px] text-[--muted] active:scale-95 transition-transform"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-[--foreground] mb-6">Edit Goal</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[--foreground]">Title</label>
          <input
            className="border border-[--border] rounded-xl px-3.5 py-3 text-[14px] bg-[--surface] text-[--foreground] focus:outline-none focus:border-[--primary] focus:ring-1 focus:ring-[--primary] transition-colors"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[--foreground]">Frequency</label>
          <div className="flex gap-2 flex-wrap">
            {CADENCES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCadence(value)}
                className={`px-3.5 py-1.5 rounded-full border text-[13px] font-medium transition-colors duration-150 ${
                  cadence === value
                    ? "bg-[--primary] text-[--foreground] border-[--primary]"
                    : "border-[--border] text-[--muted] bg-transparent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {cadence !== "once" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[--foreground]">
              Target (times per {cadenceUnit(cadence)})
            </label>
            <input
              type="number"
              min="1"
              max="365"
              className="border border-[--border] rounded-xl px-3.5 py-3 text-[14px] w-24 bg-[--surface] text-[--foreground] focus:outline-none focus:border-[--primary] focus:ring-1 focus:ring-[--primary] transition-colors"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
        )}

        {/* Shared toggle */}
        <div className="bg-[--surface] border border-[--border] rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-[--foreground]">Shared goal</p>
            <p className="text-[12px] text-[--muted]">Both of you can see and check in</p>
          </div>
          <Toggle checked={isShared} onChange={() => setIsShared(!isShared)} />
        </div>

        {/* Joint vs individual — only shown when shared is on */}
        {isShared && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-medium text-[--foreground]">How you track it</p>
            <div className="flex flex-col gap-2">
              <div
                onClick={() => setIsJoint(false)}
                className="flex items-start gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-colors duration-150"
                style={{
                  borderColor: !isJoint ? "var(--primary)" : "var(--border)",
                  backgroundColor: !isJoint ? "var(--primary-light)" : "var(--surface)",
                }}
              >
                <div
                  className="w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: !isJoint ? "var(--primary)" : "var(--muted)" }}
                >
                  {!isJoint && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />}
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[--foreground]">Each person separately</p>
                  <p className="text-[12px] text-[--muted] mt-0.5">You each log your own check-ins — e.g. working out</p>
                </div>
              </div>

              <div
                onClick={() => setIsJoint(true)}
                className="flex items-start gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-colors duration-150"
                style={{
                  borderColor: isJoint ? "var(--primary)" : "var(--border)",
                  backgroundColor: isJoint ? "var(--primary-light)" : "var(--surface)",
                }}
              >
                <div
                  className="w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: isJoint ? "var(--primary)" : "var(--muted)" }}
                >
                  {isJoint && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />}
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[--foreground]">Together as one</p>
                  <p className="text-[12px] text-[--muted] mt-0.5">One check-in counts for both of you — e.g. date night</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reminder — only meaningful for recurring goals */}
        {cadence !== "once" && (
          <div className="bg-[--surface] border border-[--border] rounded-2xl px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-[--muted]" />
                <div>
                  <p className="text-[14px] font-medium text-[--foreground]">Reminder</p>
                  <p className="text-[12px] text-[--muted]">Push notification if not done yet</p>
                </div>
              </div>
              <Toggle checked={remEnabled} onChange={() => setRemEnabled(!remEnabled)} />
            </div>

            {remEnabled && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[--muted] mr-1">At</span>
                  <select
                    value={remHour12}
                    onChange={(e) => setRemHour12(parseInt(e.target.value))}
                    className="border border-[--border] rounded-xl px-2.5 py-2 text-[14px] bg-[--surface] text-[--foreground] focus:outline-none focus:border-[--primary]"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="text-[14px] text-[--muted]">:</span>
                  <select
                    value={remMinute}
                    onChange={(e) => setRemMinute(parseInt(e.target.value) === 30 ? 30 : 0)}
                    className="border border-[--border] rounded-xl px-2.5 py-2 text-[14px] bg-[--surface] text-[--foreground] focus:outline-none focus:border-[--primary]"
                  >
                    <option value={0}>00</option>
                    <option value={30}>30</option>
                  </select>
                  <select
                    value={remAmpm}
                    onChange={(e) => setRemAmpm(e.target.value === "PM" ? "PM" : "AM")}
                    className="border border-[--border] rounded-xl px-2.5 py-2 text-[14px] bg-[--surface] text-[--foreground] focus:outline-none focus:border-[--primary]"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>

                {cadence === "weekly" && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] text-[--muted]">On</span>
                    <div className="flex gap-1.5">
                      {["S","M","T","W","T","F","S"].map((label, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRemDow(idx)}
                          className="w-8 h-8 rounded-full text-[12px] font-semibold transition-colors"
                          style={{
                            background: remDow === idx ? "var(--primary)" : "transparent",
                            color: remDow === idx ? "#fff" : "var(--muted)",
                            border: `1px solid ${remDow === idx ? "var(--primary)" : "var(--border)"}`,
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-[--muted]">
                  Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Reminders are personal — your partner won&apos;t see them.
                </p>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!title.trim() || loading}
          className="mt-2 bg-[--primary] text-[--foreground] font-semibold py-4 rounded-2xl text-[15px] disabled:opacity-40 active:scale-95 transition-transform border border-[#a05a3c] shadow-sm"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
