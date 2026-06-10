"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import { ArrowLeft } from "lucide-react";

export default function NewDreamPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { couple } = useAppData();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!couple || !user) return;
    setLoading(true);

    await supabase.from("dreams").insert({
      couple_id: couple.id,
      owner_id: isShared ? null : user.id,
      title: title.trim(),
      note: note.trim() || null,
      emoji: "✨",
    });

    router.push("/dreams");
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

      <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-[--foreground] mb-6">
        New Dream
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[--foreground]">Title</label>
          <input
            className="border border-[--border] rounded-xl px-3.5 py-3 text-[14px] bg-[--surface] text-[--foreground] focus:outline-none focus:border-[--primary] focus:ring-1 focus:ring-[--primary] transition-colors"
            placeholder="e.g. Visit Japan together"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[--foreground]">
            Note <span className="text-[--muted] font-normal">(optional)</span>
          </label>
          <textarea
            className="border border-[--border] rounded-xl px-3.5 py-3 text-[14px] bg-[--surface] text-[--foreground] focus:outline-none focus:border-[--primary] focus:ring-1 focus:ring-[--primary] transition-colors resize-none"
            placeholder="Any details or inspiration..."
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="bg-[--surface] border border-[--border] rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-[--foreground]">Shared dream</p>
            <p className="text-[12px] text-[--muted]">Both of you can see it</p>
          </div>
          <button
            type="button"
            onClick={() => setIsShared(!isShared)}
            className={`w-10 h-5 rounded-full relative transition-colors ${isShared ? "bg-[--primary]" : "bg-[--border]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isShared ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        <button
          type="submit"
          disabled={!title.trim() || loading}
          className="mt-2 bg-[--primary] text-[--foreground] font-semibold py-4 rounded-2xl text-[15px] disabled:opacity-40 active:scale-95 transition-transform border border-[#a05a3c] shadow-sm"
        >
          {loading ? "Adding..." : "Add dream"}
        </button>
      </form>
    </div>
  );
}
