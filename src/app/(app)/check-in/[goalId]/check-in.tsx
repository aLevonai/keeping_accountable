"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { Camera, Check } from "lucide-react";
import { useAppData } from "@/contexts/app-data";
import { useGoal } from "@/hooks/use-goal";
import { useActions } from "@/lib/actions";
import { goalProgress } from "@/utils/goal-progress";
import { getPeriodLabel } from "@/utils/period";
import { toast } from "@/components/ui/feedback";
import { BackButton, firstName } from "@/components/ui/bits";
import { Tapes } from "@/components/ui/paper";
import { seeded } from "@/utils/seeded";

const BACKDATE_DAYS = 7;

function dayLabel(d: Date, today: Date): string {
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, addDays(today, -1))) return "Yesterday";
  return format(d, "EEE d");
}

export function CheckIn({ goalId }: { goalId: string }) {
  const router = useRouter();
  const { user, partner } = useAppData();
  const { goal, notFound } = useGoal(goalId);
  const actions = useActions();

  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Revoke the preview's object URL when it changes or the page unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const leave = () => {
    if (window.history.length > 1) router.back();
    else router.replace("/home");
  };

  // Return to wherever the user came from shortly after saving.
  useEffect(() => {
    if (!savedId) return;
    const t = setTimeout(leave, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId]);

  if (notFound) {
    return (
      <div className="px-5 pt-14">
        <BackButton />
        <p className="text-muted text-sm">This goal no longer exists.</p>
      </div>
    );
  }

  const color = goal?.color && goal.color !== "#374151" ? goal.color : "#C4704F";
  const today = startOfDay(new Date());
  const days = Array.from({ length: BACKDATE_DAYS }, (_, i) => addDays(today, -i));

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal || saving) return;
    setSaving(true);

    let completedAt = new Date();
    if (!isSameDay(day, today)) {
      completedAt = new Date(day);
      const now = new Date();
      completedAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }

    const id = await actions.logCheckIn({ goal, completedAt, note, photo });
    setSaving(false);
    if (!id) return;
    setSavedId(id);
    toast(`Logged “${goal.title}”`, {
      action: { label: "Undo", onClick: () => void actions.deleteCheckIn({ id, goal_id: goal.id }) },
    });
  }

  if (savedId && goal) {
    const p = goalProgress(goal, user?.id, partner?.id);
    const period = getPeriodLabel(goal.cadence);
    const line =
      goal.cadence === "once" ? "Done — nice work."
      : p.mode === "separate"
        ? `You're at ${p.myCount}/${p.target} ${period}${partner ? ` · ${firstName(partner.display_name, "Partner")} is at ${p.partnerCount}/${p.target}` : ""}`
        : `${p.total}/${p.target} ${period}${p.mode === "joint" ? " together" : ""}`;
    const complete = goal.cadence !== "once" && p.myDone;

    return (
      <button onClick={leave} className="paper-bg min-h-screen w-full flex flex-col items-center justify-center gap-4 px-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center animate-pop-in"
          style={{ background: complete ? "var(--success-light)" : `color-mix(in srgb, ${color} 16%, transparent)` }}
        >
          <Check size={26} style={{ color: complete ? "var(--success)" : color }} />
        </div>
        <p className="font-[family-name:var(--font-instrument-serif)] italic text-[30px] text-foreground text-center">
          {complete ? "Target hit!" : "Logged"}
        </p>
        <p className="text-[15px] text-foreground text-center font-medium">{goal.title}</p>
        <p className="font-hand text-[21px] leading-tight text-[#6E6053] text-center">{line}</p>
        {photo && <p className="font-hand text-[18px] text-muted text-center">your photo is on its way to the journal…</p>}
      </button>
    );
  }

  return (
    <div className="paper-bg px-5 pt-14 pb-40 -mb-24 min-h-screen">
      <BackButton />

      <div className="flex items-center gap-3 mb-6">
        <div style={{ width: 48, height: 48, borderRadius: 10, background: goal?.color ?? "var(--border)", flexShrink: 0 }} />
        <div className="min-w-0">
          <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted">Logging</p>
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[28px] text-foreground leading-tight truncate">
            {goal?.title ?? " "}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          {preview ? (
            <div className="relative bg-white p-2.5 pb-8 -rotate-1 shadow-[0_2px_6px_rgba(60,40,20,0.16),0_16px_24px_-16px_rgba(60,40,20,0.4)]">
              <Tapes r={seeded(goalId + ":checkin")} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="w-full aspect-[4/3] object-cover" />
              <button
                type="button"
                onClick={() => { setPhoto(null); setPreview(null); }}
                className="absolute top-3 right-3 bg-white/90 border border-border rounded-lg px-3 py-1 text-[12px] text-muted font-medium"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-full bg-white p-2.5 pb-8 -rotate-1 shadow-[0_2px_6px_rgba(60,40,20,0.16),0_16px_24px_-16px_rgba(60,40,20,0.4)] active:scale-[0.98] transition-transform"
            >
              <Tapes r={seeded(goalId + ":checkin")} />
              <span className="w-full aspect-[4/3] bg-[#EEE7DE] flex flex-col items-center justify-center gap-2">
                <Camera size={26} className="text-[#8A7B6E]" strokeWidth={1.5} />
                <span className="font-hand text-[21px] leading-none text-[#8A7B6E]">tap to add a photo</span>
              </span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-hand text-[20px] leading-none text-[#6E6053]">when?</span>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
            {days.map((d) => {
              const active = isSameDay(d, day);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setDay(d)}
                  aria-pressed={active}
                  className="flex-shrink-0 px-3.5 py-1.5 rounded-full border text-[13px] font-medium transition-colors"
                  style={{
                    background: active ? color : "transparent",
                    borderColor: active ? color : "var(--border)",
                    color: active ? "white" : "var(--muted)",
                  }}
                >
                  {dayLabel(d, today)}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          className="w-full px-4 pt-[6px] pb-2 font-hand text-[22px] leading-[30px] text-[#2F3A56] placeholder:text-[#B0A596] resize-none focus:outline-none shadow-[0_2px_5px_rgba(60,40,20,0.1)] border-l-[3px] border-l-[rgba(214,120,120,0.45)]"
          style={{ background: "repeating-linear-gradient(#FFFDF8 0 29px, rgba(120,160,200,0.3) 29px 30px)" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = color; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
          rows={3}
          dir="auto"
          placeholder="How did it go?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button
          type="submit"
          disabled={saving || !goal}
          className="w-full py-4 rounded-2xl text-[15px] font-semibold shadow-sm text-white disabled:opacity-50 active:scale-[0.98] transition-transform"
          style={{ background: color }}
        >
          {saving ? "Saving…" : isSameDay(day, today) ? "Log check-in" : `Log for ${dayLabel(day, today).toLowerCase()}`}
        </button>
      </form>
    </div>
  );
}
