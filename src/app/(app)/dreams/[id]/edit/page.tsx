"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft } from "lucide-react";

const EMOJIS = ["🌟", "✈️", "🏠", "💍", "🎓", "🌍", "🏔️", "🎨", "🎵", "🍜", "🏄", "🌺", "💪", "📚", "🚀"];

export default function EditDreamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [emoji, setEmoji] = useState("🌟");
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("dreams")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (!data) { setNotFound(true); setFetching(false); return; }
        setTitle(data.title);
        setNote(data.note ?? "");
        setEmoji(data.emoji ?? "🌟");
        setIsShared(data.owner_id === null);
        setFetching(false);
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    await supabase
      .from("dreams")
      .update({
        title: title.trim(),
        note: note.trim() || null,
        emoji,
        owner_id: isShared ? null : user.id,
      })
      .eq("id", id);

    router.push("/dreams");
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
        <p className="text-[--muted] text-sm">Dream not found.</p>
        <button onClick={() => router.push("/dreams")} className="text-sm text-[--primary] font-semibold underline">
          Back to dreams
        </button>
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

      <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-[--foreground] mb-6">
        Edit Dream
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Emoji picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[--foreground]">Emoji</label>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-10 h-10 rounded-xl text-[20px] flex items-center justify-center border transition-colors duration-150 ${
                  emoji === e ? "border-[--primary] bg-[--primary-light]" : "border-[--border] bg-[--surface]"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[--foreground]">Title</label>
          <input
            className="border border-[--border] rounded-xl px-3.5 py-3 text-[14px] bg-[--surface] text-[--foreground] focus:outline-none focus:border-[--primary] focus:ring-1 focus:ring-[--primary] transition-colors"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            placeholder="e.g. Move to Italy"
          />
        </div>

        {/* Note */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[--foreground]">Note <span className="text-[--muted] font-normal">(optional)</span></label>
          <textarea
            className="border border-[--border] rounded-xl px-3.5 py-3 text-[14px] bg-[--surface] text-[--foreground] placeholder:text-[--muted] resize-none focus:outline-none focus:border-[--primary] focus:ring-1 focus:ring-[--primary] transition-colors"
            rows={3}
            placeholder="Any details..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Shared toggle */}
        <div className="bg-[--surface] border border-[--border] rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-[--foreground]">Shared dream</p>
            <p className="text-[12px] text-[--muted]">Both of you see and own this</p>
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
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
