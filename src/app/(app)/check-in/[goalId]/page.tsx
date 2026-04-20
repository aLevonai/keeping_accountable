"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";
import { uploadPhoto } from "@/utils/storage";

export default function CheckInPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { couple } = useCouple(user?.id);
  const supabase = createClient();

  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

    // Insert completion
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

    // Upload photo if selected
    if (photo) {
      try {
        const path = await uploadPhoto(photo, couple.id, user.id, completion.id);
        await supabase.from("completion_media").insert({
          completion_id: completion.id,
          storage_path: path,
          media_type: "photo",
        });
      } catch {
        // Photo upload failed but completion was saved — don't block navigation
      }
    }

    router.push("/home");
  }

  return (
    <div className="px-4 pt-12 pb-8 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 underline">← Back</button>
        <h1 className="text-lg font-bold text-gray-900">Check In</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Photo — optional */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Photo <span className="text-gray-400 font-normal">(optional)</span></label>

          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="w-full max-h-64 object-cover rounded border border-gray-200" />
              <button
                type="button"
                onClick={() => { setPhoto(null); setPreview(null); }}
                className="absolute top-2 right-2 bg-white border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-600"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="border border-dashed border-gray-300 rounded px-4 py-6 text-sm text-gray-400 text-center hover:bg-gray-50"
            >
              Tap to add a photo
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Note — optional */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Note <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            className="border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows={3}
            placeholder="How did it go?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-gray-900 text-white font-medium py-3 rounded text-sm disabled:opacity-40"
        >
          {loading ? "Saving..." : "Log check-in"}
        </button>
      </form>
    </div>
  );
}
