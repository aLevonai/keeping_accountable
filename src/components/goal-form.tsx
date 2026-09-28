"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import type { Cadence } from "@/types/database";
import { cadenceUnit } from "@/utils/goal-progress";
import { Toggle } from "@/components/ui/bits";

const CADENCES: { value: Cadence; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "once", label: "One-time" },
];

export interface GoalFormValues {
  title: string;
  cadence: Cadence;
  cadence_target: number;
  shared: boolean;
  is_joint: boolean;
  reminder: { enabled: boolean; hour: number; minute: number; day_of_week: number | null };
}

export const DEFAULT_GOAL_VALUES: GoalFormValues = {
  title: "",
  cadence: "weekly",
  cadence_target: 3,
  shared: false,
  is_joint: false,
  reminder: { enabled: false, hour: 20, minute: 0, day_of_week: 0 },
};

const inputClass =
  "border border-border rounded-xl px-3.5 py-3 text-[16px] bg-surface text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors";

function Choice({ selected, onSelect, title, subtitle }: { selected: boolean; onSelect: () => void; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex items-start gap-3 px-4 py-3 rounded-2xl border text-left transition-colors duration-150"
      style={{
        borderColor: selected ? "var(--primary)" : "var(--border)",
        backgroundColor: selected ? "var(--primary-light)" : "var(--surface)",
      }}
    >
      <div
        className="w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center"
        style={{ borderColor: selected ? "var(--primary)" : "var(--muted)" }}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
      <div>
        <p className="text-[14px] font-medium text-foreground">{title}</p>
        <p className="text-[12px] text-muted mt-0.5">{subtitle}</p>
      </div>
    </button>
  );
}

export function GoalForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: GoalFormValues;
  submitLabel: string;
  onSubmit: (values: GoalFormValues) => void | Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [target, setTarget] = useState(String(initial.cadence_target));
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<GoalFormValues>) => setV((prev) => ({ ...prev, ...patch }));
  const setRem = (patch: Partial<GoalFormValues["reminder"]>) => setV((prev) => ({ ...prev, reminder: { ...prev.reminder, ...patch } }));

  const hour12 = v.reminder.hour % 12 === 0 ? 12 : v.reminder.hour % 12;
  const ampm = v.reminder.hour >= 12 ? "PM" : "AM";
  const setTime = (h12: number, ap: string) => setRem({ hour: (h12 % 12) + (ap === "PM" ? 12 : 0) });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.title.trim() || busy) return;
    setBusy(true);
    await onSubmit({ ...v, cadence_target: Math.max(1, parseInt(target) || 1) });
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="goal-title" className="text-[13px] font-medium text-foreground">Title</label>
        <input
          id="goal-title"
          className={inputClass}
          placeholder="e.g. Work out 3 times a week"
          value={v.title}
          onChange={(e) => set({ title: e.target.value })}
          dir="auto"
          required
          autoFocus={!initial.title}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-foreground">Frequency</span>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Frequency">
          {CADENCES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={v.cadence === value}
              onClick={() => set({ cadence: value })}
              className={`px-3.5 py-1.5 rounded-full border text-[13px] font-medium transition-colors duration-150 ${
                v.cadence === value ? "bg-primary text-white border-primary" : "border-border text-muted bg-transparent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {v.cadence !== "once" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="goal-target" className="text-[13px] font-medium text-foreground">
            Target (times per {cadenceUnit(v.cadence)})
          </label>
          <input
            id="goal-target"
            type="number"
            inputMode="numeric"
            min="1"
            max="365"
            className={`${inputClass} w-24`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium text-foreground">Shared goal</p>
          <p className="text-[12px] text-muted">Both of you can see and check in</p>
        </div>
        <Toggle checked={v.shared} onChange={(shared) => set({ shared })} label="Shared goal" />
      </div>

      {v.shared && (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="How you track it">
          <p className="text-[13px] font-medium text-foreground">How you track it</p>
          <Choice
            selected={!v.is_joint}
            onSelect={() => set({ is_joint: false })}
            title="Each person separately"
            subtitle="You each log your own check-ins — e.g. working out"
          />
          <Choice
            selected={v.is_joint}
            onSelect={() => set({ is_joint: true })}
            title="Together as one"
            subtitle="One check-in counts for both of you — e.g. date night"
          />
        </div>
      )}

      {v.cadence !== "once" && (
        <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-muted" />
              <div>
                <p className="text-[14px] font-medium text-foreground">Reminder</p>
                <p className="text-[12px] text-muted">Push notification if not done yet</p>
              </div>
            </div>
            <Toggle checked={v.reminder.enabled} onChange={(enabled) => setRem({ enabled })} label="Reminder" />
          </div>

          {v.reminder.enabled && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-muted mr-1">At</span>
                <select
                  aria-label="Hour"
                  value={hour12}
                  onChange={(e) => setTime(parseInt(e.target.value), ampm)}
                  className="border border-border rounded-xl px-2.5 py-2 text-[16px] bg-surface text-foreground focus:outline-none focus:border-primary"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="text-[14px] text-muted">:</span>
                <select
                  aria-label="Minute"
                  value={v.reminder.minute}
                  onChange={(e) => setRem({ minute: parseInt(e.target.value) === 30 ? 30 : 0 })}
                  className="border border-border rounded-xl px-2.5 py-2 text-[16px] bg-surface text-foreground focus:outline-none focus:border-primary"
                >
                  <option value={0}>00</option>
                  <option value={30}>30</option>
                </select>
                <select
                  aria-label="AM or PM"
                  value={ampm}
                  onChange={(e) => setTime(hour12, e.target.value)}
                  className="border border-border rounded-xl px-2.5 py-2 text-[16px] bg-surface text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>

              {v.cadence === "weekly" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-muted">On</span>
                  <div className="flex gap-1.5">
                    {["S", "M", "T", "W", "T", "F", "S"].map((label, idx) => {
                      const on = (v.reminder.day_of_week ?? 0) === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          aria-pressed={on}
                          aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][idx]}
                          onClick={() => setRem({ day_of_week: idx })}
                          className="w-8 h-8 rounded-full text-[12px] font-semibold transition-colors"
                          style={{
                            background: on ? "var(--primary)" : "transparent",
                            color: on ? "#fff" : "var(--muted)",
                            border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted">
                Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Reminders are personal — your partner won&apos;t see them.
              </p>
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!v.title.trim() || busy}
        className="mt-2 bg-primary text-white font-semibold py-4 rounded-2xl text-[15px] disabled:opacity-40 active:scale-[0.98] transition-transform shadow-sm"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
