"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import { countCompletionsInPeriod, getPeriodLabel, getPeriodRange } from "@/utils/period";
import { getPhotoUrl } from "@/utils/storage";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { couple, partner } = useCouple(user?.id);
  const supabase = createClient();
  const [goal, setGoal] = useState<GoalWithCompletions | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("goals")
      .select("*, completions(*, completion_media(*))")
      .eq("id", id)
      .single()
      .then(({ data }) => setGoal(data as GoalWithCompletions));
  }, [id]);

  if (!goal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-bounce">💫</div>
      </div>
    );
  }

  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const progress = target > 0 ? count / target : 0;
  const done = count >= target;
  const periodLabel = getPeriodLabel(goal.cadence);
  const isOwnerOrShared = goal.owner_id === null || goal.owner_id === user?.id;

  async function handleArchive() {
    await supabase
      .from("goals")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", goal!.id);
    router.push("/goals");
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <div
        className="px-4 pt-14 pb-6 flex flex-col gap-4"
        style={{ backgroundColor: `${goal.color}15` }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/70">
            <ArrowLeft size={18} className="text-stone-600" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
            style={{ backgroundColor: `${goal.color}25` }}
          >
            {goal.emoji}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-stone-900">{goal.title}</h1>
            <p className="text-sm text-stone-500 capitalize">
              {goal.owner_id === null ? "Shared goal 💑" : goal.owner_id === user?.id ? "Your goal" : `${partner?.display_name}'s goal`}
              {" · "}
              {goal.cadence}
            </p>
          </div>
        </div>

        {/* Progress */}
        {goal.cadence !== "once" && (
          <div className="flex items-center gap-4 bg-white/70 rounded-2xl px-4 py-3">
            <ProgressRing progress={progress} size={52} strokeWidth={5} color={done ? "#22c55e" : goal.color} trackColor={`${goal.color}20`} />
            <div>
              <p className="font-bold text-stone-900">{count} of {target} {periodLabel}</p>
              <p className="text-xs text-stone-500">{done ? "Goal reached! 🎉" : `${target - count} more to go`}</p>
            </div>
          </div>
        )}
      </div>

      {/* Check in button */}
      {isOwnerOrShared && (
        <div className="px-4 py-4 border-b border-stone-100">
          <Link
            href={`/check-in/${goal.id}`}
            className="flex items-center justify-center gap-2 w-full bg-rose-500 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform shadow-sm"
          >
            <Camera size={18} />
            Check in with a photo
          </Link>
        </div>
      )}

      {/* Completion history */}
      <div className="flex flex-col px-4 py-4 gap-3">
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">History</h2>
        {goal.completions.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-6">No check-ins yet. Be the first!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {([...goal.completions] as CompletionWithMedia[]).reverse().map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                {c.completion_media?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getPhotoUrl(c.completion_media[0].storage_path)}
                    alt="Check-in photo"
                    className="w-full aspect-video object-cover"
                  />
                )}
                <div className="px-3 py-2 flex items-center justify-between">
                  {c.note && <p className="text-sm text-stone-700">{c.note}</p>}
                  <p className="text-xs text-stone-400 ml-auto">
                    {format(new Date(c.completed_at), "MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archive */}
      {isOwnerOrShared && (
        <div className="px-4 pb-8 mt-auto">
          <Button variant="ghost" size="sm" onClick={handleArchive} className="text-stone-400 text-xs">
            Archive this goal
          </Button>
        </div>
      )}
    </div>
  );
}

interface CompletionWithMedia {
  id: string;
  goal_id: string;
  user_id: string;
  note: string | null;
  completed_at: string;
  created_at: string;
  completion_media: { storage_path: string }[];
}
