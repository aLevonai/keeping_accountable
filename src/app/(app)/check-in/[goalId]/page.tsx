"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";
import { uploadPhoto } from "@/utils/storage";
import { ArrowLeft, Camera, Check } from "lucide-react";

export default function CheckInPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { couple, self, partner } = useCouple(user?.id);
  const supabase = createClient();

  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [goalTitle, setGoalTitle] = useState<string | null>(null);
  const [goalColor, setGoalColor] = useState<string>("#C4704F");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!goalId) return;
    supabase
      .from("goals")
      .select("title, color")
      .eq("id", goalId)
      .single()
      .then(({ data }) => {
        setGoalTitle(data?.title ?? null);
        if (data?.color) setGoalColor(data.color);
      });
  }, [goalId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !couple) return;
    setLoading(true);

    const { data: completion, error } = await supabase
      .from("completions")
      .insert({
        goal_id: goalId,
        user_id: user.id,
        note: note.trim() || null,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !completion) {
      setLoading(false);
      alert("Something went wrong. Try again.");
      return;
    }

    if (photo) {
      try {
        const path = await uploadPhoto(photo, couple.id, user.id, completion.id);
        await supabase.from("completion_media").insert({
          completion_id: completion.id,
          storage_path: path,
          media_type: "photo",
        });
      } catch {
        // Photo upload failed but completion was saved
      }
    }

    if (partner?.id && goalTitle) {
      try {
        await supabase.functions.invoke("send-push", {
          body: {
            target_user_id: partner.id,
            title: "CheckMate",
            body: `${self?.display_name ?? "Your partner"} just checked in on "${goalTitle}"`,
          },
        });
      } catch {
        // Ignore notification errors
      }
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 bg-[--background]">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: goalColor + "25" }}
        >
          <Check size={22} style={{ color: goalColor }} />
        </div>
        <p className="font-[family-name:var(--font-instrument-serif)] italic text-[20px] text-[--foreground] text-center">
          Logged
        </p>
        <p className="text-[14px] text-[--muted] text-center">{goalTitle}</p>
        <button
          onClick={() => router.push("/goals")}
          className="mt-2 text-[14px]"
          style={{ color: goalColor }}
        >
          ← Back to goals
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 pb-8 min-h-screen bg-[--background]">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-[14px] text-[--muted] mb-6 active:scale-95 transition-transform"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Goal header with color chip */}
      <div className="flex items-center gap-3 mb-6">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: goalColor,
            flexShrink: 0,
          }}
        />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[--muted]">Logging</p>
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[22px] text-[--foreground] leading-tight">
            {goalTitle ?? "Goal"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Photo upload area */}
        <div>
          {preview ? (
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-[--border]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { setPhoto(null); setPreview(null); }}
                className="absolute top-3 right-3 bg-white/90 border border-[--border] rounded-lg px-3 py-1 text-[12px] text-[--muted] font-medium"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full aspect-[4/3] rounded-2xl border-[1.5px] border-dashed border-[--border] bg-[--surface] flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Camera size={24} className="text-[--muted]" strokeWidth={1.5} />
              <span className="text-[13px] text-[--muted]">Add a photo</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Note */}
        <textarea
          className="w-full border border-[--border] rounded-xl p-3 text-[14px] bg-[--surface] text-[--foreground] placeholder:text-[--muted] resize-none focus:outline-none transition-colors"
          style={{
            "--tw-ring-color": goalColor,
          } as React.CSSProperties}
          onFocus={e => {
            e.currentTarget.style.borderColor = goalColor;
            e.currentTarget.style.boxShadow = `0 0 0 1px ${goalColor}60`;
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = "";
            e.currentTarget.style.boxShadow = "";
          }}
          rows={3}
          placeholder="How did it go?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl text-[15px] font-semibold shadow-sm disabled:opacity-40 active:scale-95 transition-transform"
          style={{
            background: goalColor,
            color: "white",
            border: `1px solid ${goalColor}cc`,
          }}
        >
          {loading ? "Saving..." : "Log check-in"}
        </button>
      </form>
    </div>
  );
}
