"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/bits";

export interface DreamFormValues {
  title: string;
  note: string;
  shared: boolean;
}

const inputClass =
  "border border-border rounded-xl px-3.5 py-3 text-[16px] bg-surface text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors";

export function DreamForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: DreamFormValues;
  submitLabel: string;
  onSubmit: (v: DreamFormValues) => void | Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.title.trim() || busy) return;
        setBusy(true);
        await onSubmit(v);
        setBusy(false);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="dream-title" className="text-[13px] font-medium text-foreground">Title</label>
        <input
          id="dream-title"
          className={inputClass}
          placeholder="e.g. Visit Japan together"
          value={v.title}
          onChange={(e) => setV({ ...v, title: e.target.value })}
          dir="auto"
          required
          autoFocus={!initial.title}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dream-note" className="text-[13px] font-medium text-foreground">
          Note <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          id="dream-note"
          className={`${inputClass} resize-none`}
          placeholder="Any details or inspiration..."
          rows={3}
          dir="auto"
          value={v.note}
          onChange={(e) => setV({ ...v, note: e.target.value })}
        />
      </div>

      <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium text-foreground">Shared dream</p>
          <p className="text-[12px] text-muted">A dream for the two of you</p>
        </div>
        <Toggle checked={v.shared} onChange={(shared) => setV({ ...v, shared })} label="Shared dream" />
      </div>

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
