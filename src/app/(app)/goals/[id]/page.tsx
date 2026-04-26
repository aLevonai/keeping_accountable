"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import { countCompletionsInPeriod, getPeriodLabel, calculateStreak } from "@/utils/period";
import { getPhotoUrl, uploadPhoto } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Pencil, ImagePlus } from "lucide-react";
import { GoalDetailSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { format } from "date-fns";

interface CompletionWithMedia {
  id: string;
  goal_id: string;
  user_id: string;
  note: string | null;
  completed_at: string;
  created_at: string;
  completion_media: { id: string; storage_path: string }[];
}

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { partner, couple } = useCouple(user?.id);
  const supabase = createClient();
  const [goal, setGoal] = useState<GoalWithCompletions | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [changingPhotoId, setChangingPhotoId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingMediaId = useRef<string | null>(null);
  const pendingCompletionId = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("goals")
      .select("*, completions(*, completion_media(*))")
      .eq("id", id)
      .single();
    if (!data) {
      setNotFound(true);
    } else {
      setGoal(data as GoalWithCompletions);
    }
  }, [id]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`goal-${id}-completions`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "completions", filter: `goal_id=eq.${id}` },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  async function handleNudge() {
    if (!partner) return;
    setNudgeSent(true);
    try {
      await supabase.functions.invoke("send-push", {
        body: {
          target_user_id: partner.id,
          title: "Together",
          body: `Time to work on "${goal?.title}"! Your partner is rooting for you.`,
        },
      });
    } catch {
      // Silently fail — nudge is best-effort
    }
    setTimeout(() => setNudgeSent(false), 3000);
  }

  async function handleArchive() {
    await supabase
      .from("goals")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", goal!.id);
    router.push("/goals");
  }

  async function handleDelete() {
    if (!window.confirm("Permanently delete this goal and all its check-ins? This cannot be undone.")) return;
    await supabase.from("goals").delete().eq("id", goal!.id);
    router.push("/goals");
  }

  function openChangePhoto(mediaId: string, completionId: string) {
    pendingMediaId.current = mediaId;
    pendingCompletionId.current = completionId;
    photoInputRef.current?.click();
  }

  async function handleChangePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingMediaId.current || !pendingCompletionId.current || !user || !couple) return;
    setChangingPhotoId(pendingMediaId.current);
    try {
      const newPath = await uploadPhoto(file, couple.id, user.id, pendingCompletionId.current);
      await supabase
        .from("completion_media")
        .update({ storage_path: newPath })
        .eq("id", pendingMediaId.current);
      await load();
    } catch {
      // Upload failed — keep existing photo
    } finally {
      setChangingPhotoId(null);
      pendingMediaId.current = null;
      pendingCompletionId.current = null;
      // Reset input so same file can be re-selected
      e.target.value = "";
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-6 text-center">
        <p className="text-[--muted] text-sm">Goal not found.</p>
        <button onClick={() => router.push("/goals")} className="text-sm text-[--primary] font-semibold underline">
          Back to goals
        </button>
      </div>
    );
  }

  if (!goal) {
    return <GoalDetailSkeleton />;
  }

  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const progress = target > 0 ? Math.min(count / target, 1) * 100 : 0;
  const done = count >= target;
  const periodLabel = getPeriodLabel(goal.cadence);
  const streak = calculateStreak(goal.completions, goal.cadence, target);
  const isOwnerOrShared = goal.owner_id === null || goal.owner_id === user?.id;
  const canNudge = partner && (goal.owner_id === partner.id || goal.owner_id === null);
  const sortedCompletions = (goal.completions as CompletionWithMedia[]).slice().reverse();

  const ownerLabel = goal.owner_id === null
    ? "Shared goal"
    : goal.owner_id === user?.id
    ? "Your goal"
    : `${partner?.display_name ?? "Partner"}'s goal`;

  return (
    <div className="flex flex-col min-h-screen bg-[--background]">
      {/* Hidden file input for changing photo */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChangePhoto}
      />

      {/* Header */}
      <div className="px-5 pt-14 pb-4 bg-[--surface] border-b border-[--border]">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-[14px] text-[--muted] active:scale-95 transition-transform"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          {isOwnerOrShared && (
            <Link
              href={`/goals/${goal.id}/edit`}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[--border] bg-[--surface] active:scale-95 transition-transform"
            >
              <Pencil size={15} className="text-[--muted]" />
            </Link>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[--muted]">{ownerLabel} · {goal.cadence}</p>
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-[--foreground] leading-tight mt-1">
            {goal.title}
          </h1>
        </div>

        {/* Progress */}
        {goal.cadence !== "once" && (
          <div className="mt-4 bg-[--surface-alt] rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium text-[--foreground]">{count} of {target} {periodLabel}</span>
              <span className="text-[13px] text-[--muted]">{done ? "Goal reached" : `${target - count} to go`}</span>
            </div>
            <div className="h-[4px] rounded-full bg-[--border] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%`, backgroundColor: done ? "var(--success)" : "var(--primary)" }}
              />
            </div>
            {streak >= 2 && (
              <p className="text-[11px] text-[--muted] mt-2">{streak} {goal.cadence === "weekly" ? "week" : goal.cadence === "monthly" ? "month" : "period"} streak</p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 py-4 border-b border-[--border] flex flex-col gap-2">
        {isOwnerOrShared && (
          <Link
            href={`/check-in/${goal.id}`}
            className="flex items-center justify-center gap-2 w-full bg-[--primary] text-[--foreground] font-semibold py-4 rounded-2xl active:scale-95 transition-transform text-[15px]"
          >
            <Camera size={18} />
            Check in with a photo
          </Link>
        )}
        {canNudge && (
          <button
            onClick={handleNudge}
            disabled={nudgeSent}
            className="flex items-center justify-center gap-2 w-full border border-[--border] text-[--muted] font-medium py-3 rounded-2xl active:scale-95 transition-all disabled:opacity-60 text-[14px]"
          >
            {nudgeSent ? "Nudge sent" : `Nudge ${partner?.display_name}`}
          </button>
        )}
      </div>

      {/* Completion history */}
      <div className="flex flex-col px-5 py-4 gap-3">
        <h2 className="text-[11px] font-semibold text-[--muted] uppercase tracking-[0.08em]">History</h2>
        {goal.completions.length === 0 ? (
          <p className="text-[--muted] text-sm text-center py-6">No check-ins yet. Be the first!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedCompletions.map((c) => (
              <div key={c.id} className="bg-[--surface] rounded-2xl border border-[--border] overflow-hidden">
                {c.completion_media?.[0] ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getPhotoUrl(c.completion_media[0].storage_path)}
                      alt="Check-in photo"
                      className={`w-full aspect-video object-cover transition-opacity ${changingPhotoId === c.completion_media[0].id ? "opacity-40" : ""}`}
                    />
                    {c.user_id === user?.id && (
                      <button
                        onClick={() => openChangePhoto(c.completion_media[0].id, c.id)}
                        disabled={!!changingPhotoId}
                        className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 text-white text-[11px] font-medium px-2 py-1 rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                      >
                        <ImagePlus size={12} />
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  c.user_id === user?.id && (
                    <button
                      onClick={() => openChangePhoto("", c.id)}
                      className="w-full py-3 flex items-center justify-center gap-1.5 text-[12px] text-[--muted] border-b border-[--border] active:bg-[--surface-alt] transition-colors"
                    >
                      <ImagePlus size={14} />
                      Add photo
                    </button>
                  )
                )}
                <div className="px-3 py-2 flex items-center justify-between">
                  {c.note && <p className="text-sm text-[--foreground]">{c.note}</p>}
                  <p className="text-xs text-[--muted] ml-auto">
                    {format(new Date(c.completed_at), "MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archive + Delete */}
      {isOwnerOrShared && (
        <div className="px-5 pb-8 mt-auto flex flex-col gap-1">
          <Button variant="ghost" size="sm" onClick={handleArchive} className="text-[--muted] text-xs">
            Archive this goal
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-400 text-xs">
            Delete this goal
          </Button>
        </div>
      )}
    </div>
  );
}
