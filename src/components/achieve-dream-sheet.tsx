"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import type { DreamRow } from "@/types/database";
import { Sheet } from "@/components/ui/sheet";
import { useActions } from "@/lib/actions";
import { celebrate } from "@/components/ui/celebrate";
import { toast } from "@/components/ui/feedback";

// Achieving a dream is a big moment: capture a photo and a few words, and it
// lands in the journal as a full-width feature spread.
export function AchieveDreamSheet({ dream, onClose }: { dream: DreamRow | null; onClose: () => void }) {
  const router = useRouter();
  const { achieveDream } = useActions();
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function reset() {
    setNote("");
    setPhoto(null);
    setPreview(null);
  }

  async function submit() {
    if (!dream || saving) return;
    setSaving(true);
    const pending = achieveDream(dream, { note, photo });
    celebrate();
    onClose();
    reset();
    setSaving(false);
    toast("Added to your journal ✨", {
      action: { label: "View", onClick: () => router.push(`/journal?dream=${dream.id}`) },
      duration: 6000,
    });
    await pending;
  }

  return (
    <Sheet open={!!dream} onClose={() => { onClose(); reset(); }} label="Dream achieved">
      {dream && (
        <div className="px-5 pt-1 pb-1 flex flex-col gap-4">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Dream achieved</p>
            <h2 className="font-[family-name:var(--font-instrument-serif)] italic text-[28px] text-foreground leading-tight mt-1" dir="auto">
              {dream.title}
            </h2>
            <p className="text-[13px] text-muted mt-1">Add a photo and a few words for your journal.</p>
          </div>

          {preview ? (
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="w-full h-full object-cover" />
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
              className="w-full aspect-[16/9] rounded-2xl border-[1.5px] border-dashed border-border bg-surface-alt flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Camera size={24} className="text-muted" strokeWidth={1.5} />
              <span className="text-[13px] text-muted">Add the moment</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setPhoto(f);
              setPreview(URL.createObjectURL(f));
            }}
          />

          <textarea
            rows={3}
            dir="auto"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How did it feel?"
            className="w-full border border-border rounded-xl p-3 text-[16px] bg-surface text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-primary"
          />

          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-semibold shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            We did it!
          </button>
        </div>
      )}
    </Sheet>
  );
}
