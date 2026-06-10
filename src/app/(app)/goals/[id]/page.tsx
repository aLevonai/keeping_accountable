"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import { countCompletionsInPeriod, getPeriodLabel, calculateStreak, getStreakHistory, getPeriodRange } from "@/utils/period";
import type { Cadence } from "@/types/database";
import { getSignedPhotoUrls, uploadPhoto } from "@/utils/storage";
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

interface PeriodGroup {
  label: string;
  start: Date;
  end: Date;
  items: CompletionWithMedia[];
}

function groupByPeriod(completions: CompletionWithMedia[], cadence: Cadence): PeriodGroup[] {
  if (completions.length === 0) return [];
  if (cadence === "once") {
    return [{ label: "All time", start: new Date(0), end: new Date(), items: completions }];
  }

  const groups: PeriodGroup[] = [];
  const seen = new Set<string>();

  for (const c of completions) {
    const range = getPeriodRange(cadence, new Date(c.completed_at));
    if (!range) continue;
    const key = range.start.toISOString();
    if (!seen.has(key)) {
      seen.add(key);
      const label = cadence === "daily"
        ? format(range.start, "EEE, MMM d")
        : cadence === "weekly"
        ? `Week of ${format(range.start, "MMM d")}`
        : cadence === "monthly"
        ? format(range.start, "MMMM yyyy")
        : format(range.start, "yyyy");
      groups.push({ label, start: range.start, end: range.end, items: [] });
    }
    groups.find(g => g.start.toISOString() === key)!.items.push(c);
  }

  return groups;
}

function StreakCalendar({
  completions,
  cadence,
  target,
  color,
  label,
  accentStyle,
}: {
  completions: { completed_at: string }[];
  cadence: Cadence;
  target: number;
  color: string;
  label?: string;
  accentStyle?: { background: string; color: string; border: string };
}) {
  const periodCount = cadence === "daily" ? 14 : cadence === "weekly" ? 8 : cadence === "monthly" ? 6 : 3;
  const history = getStreakHistory(completions, cadence, target, periodCount);
  const streak = calculateStreak(completions, cadence, target);

  return (
    <div className="mt-3">
      {label && (
        <div className="flex items-center gap-1.5 mb-1.5">
          {accentStyle && (
            <div
              className="w-[14px] h-[14px] rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0"
              style={accentStyle}
            >
              {label}
            </div>
          )}
          {streak >= 2 && !accentStyle && (
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{ color }}
            >
              {streak} {cadence === "daily" ? "day" : cadence === "weekly" ? "week" : cadence === "monthly" ? "month" : "year"} streak
            </span>
          )}
          {streak >= 2 && accentStyle && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[--muted]">
              {streak} {cadence === "daily" ? "day" : cadence === "weekly" ? "week" : cadence === "monthly" ? "month" : "year"} streak
            </span>
          )}
        </div>
      )}
      {!label && streak >= 2 && (
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5"
          style={{ color }}
        >
          {streak} {cadence === "daily" ? "day" : cadence === "weekly" ? "week" : cadence === "monthly" ? "month" : "year"} streak
        </p>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {history.map((p, i) => (
          <div
            key={i}
            title={p.label}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              flexShrink: 0,
              background: p.met
                ? color
                : p.inProgress
                ? color + "33"
                : "var(--border)",
              border: p.inProgress && !p.met
                ? `1.5px solid ${color}66`
                : "none",
              opacity: p.inProgress && !p.met ? 1 : 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { partner, couple, self } = useAppData();
  const supabase = createClient();
  const [goal, setGoal] = useState<GoalWithCompletions | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
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
      const g = data as GoalWithCompletions;
      setGoal(g);
      const paths = (g.completions as CompletionWithMedia[]).flatMap(
        (c) => c.completion_media?.map((m) => m.storage_path) ?? []
      );
      setPhotoUrls(await getSignedPhotoUrls(paths));
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
          title: "CheckMate",
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

  const totalCount = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const isSharedNonJoint = goal.owner_id === null && !goal.is_joint;
  const isShared = goal.owner_id === null;
  const chipColor = goal.color ?? "var(--primary)";

  const myComps = goal.completions.filter(c => c.user_id === user?.id);
  const partnerComps = partner ? goal.completions.filter(c => c.user_id === partner.id) : [];

  // For non-joint shared: each person tracks independently
  const count = isSharedNonJoint
    ? countCompletionsInPeriod(myComps, goal.cadence)
    : totalCount;
  const partnerDetailCount = isSharedNonJoint && partner
    ? countCompletionsInPeriod(partnerComps, goal.cadence)
    : null;

  const progress = target > 0 ? Math.min(count / target, 1) * 100 : 0;
  const done = count >= target;
  const periodLabel = getPeriodLabel(goal.cadence);
  const isOwnerOrShared = goal.owner_id === null || goal.owner_id === user?.id;
  const canNudge = partner && (goal.owner_id === partner.id || goal.owner_id === null);

  // Completions for streak: per-user for non-joint shared, all for joint/personal
  const streakComps = isSharedNonJoint ? myComps : goal.completions;

  // History grouped by period (newest first → groups are newest first)
  const sortedCompletions = (goal.completions as CompletionWithMedia[]).slice().reverse();
  const periodGroups = groupByPeriod(sortedCompletions, goal.cadence);

  const ownerLabel = goal.owner_id === null
    ? "Shared goal"
    : goal.owner_id === user?.id
    ? "Your goal"
    : `${partner?.display_name ?? "Partner"}'s goal`;

  function getInitial(name: string) { return name.trim().charAt(0).toUpperCase(); }
  const selfInitial = getInitial(self?.display_name ?? "Y");
  const partnerInitial = getInitial(partner?.display_name ?? "P");

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

        {/* Progress + Streak calendar */}
        {goal.cadence !== "once" && (
          <div className="mt-4 bg-[--surface-alt] rounded-2xl px-4 py-3">
            {/* Progress bar — yours */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium text-[--foreground]">
                {isSharedNonJoint ? "You · " : ""}{count} of {target} {periodLabel}
              </span>
              <span className="text-[13px] text-[--muted]">{done ? "Done" : `${target - count} to go`}</span>
            </div>
            <div className="h-[4px] rounded-full bg-[--border] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%`, backgroundColor: done ? "var(--success)" : chipColor }}
              />
            </div>

            {/* Partner progress bar (non-joint shared only) */}
            {partnerDetailCount !== null && (
              <>
                <div className="flex items-center justify-between mt-3 mb-1">
                  <span className="text-[13px] font-medium text-[--foreground]">
                    {partner?.display_name.split(" ")[0]} · {partnerDetailCount} of {target} {periodLabel}
                  </span>
                  <span className="text-[13px] text-[--muted]">
                    {partnerDetailCount >= target ? "Done" : `${target - partnerDetailCount} to go`}
                  </span>
                </div>
                <div className="h-[4px] rounded-full bg-[--border] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-out"
                    style={{
                      width: `${Math.min(partnerDetailCount / target, 1) * 100}%`,
                      backgroundColor: partnerDetailCount >= target ? "var(--success)" : "var(--partner-accent)",
                    }}
                  />
                </div>
              </>
            )}

            {/* Streak calendar */}
            {isSharedNonJoint ? (
              // Two rows: user + partner
              <div className="mt-3 flex flex-col gap-2">
                <StreakCalendar
                  completions={myComps}
                  cadence={goal.cadence}
                  target={target}
                  color={chipColor}
                  label={selfInitial}
                  accentStyle={{ background: chipColor + "20", color: chipColor, border: `1px solid ${chipColor}40` }}
                />
                {partner && (
                  <StreakCalendar
                    completions={partnerComps}
                    cadence={goal.cadence}
                    target={target}
                    color="var(--partner-accent)"
                    label={partnerInitial}
                    accentStyle={{ background: "var(--partner-light)", color: "var(--partner-accent)", border: "1px solid rgba(74,122,155,0.4)" }}
                  />
                )}
              </div>
            ) : (
              <StreakCalendar
                completions={streakComps}
                cadence={goal.cadence}
                target={target}
                color={done ? "var(--success)" : chipColor}
              />
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

      {/* History — grouped by period */}
      <div className="flex flex-col px-5 py-4 gap-1 pb-8">
        <h2 className="text-[11px] font-bold tracking-[0.1em] uppercase text-[--muted] mb-2">History</h2>

        {goal.completions.length === 0 ? (
          <p className="text-[--muted] text-sm text-center py-6">No check-ins yet. Be the first!</p>
        ) : (
          <div className="flex flex-col gap-4">
            {periodGroups.map((group, gi) => (
              <div key={gi}>
                {/* Period header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[--muted] whitespace-nowrap">
                    {group.label}
                  </span>
                  <span className="text-[9px] font-semibold text-[--muted] bg-[--border] rounded-full px-1.5 py-px">
                    {group.items.length}/{goal.cadence === "once" ? "1" : target}
                  </span>
                  <div className="flex-1 h-px bg-[--border]" />
                </div>

                {/* Completions in this period */}
                <div className="flex flex-col gap-2.5">
                  {group.items.map((c) => (
                    <div key={c.id} className="bg-[--surface] rounded-2xl border border-[--border] overflow-hidden">
                      {c.completion_media?.[0] ? (
                        <div className="relative aspect-video bg-[--surface-alt]">
                          {photoUrls[c.completion_media[0].storage_path] && (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photoUrls[c.completion_media[0].storage_path]}
                                alt="Check-in photo"
                                loading="lazy"
                                decoding="async"
                                className={`w-full h-full object-cover transition-opacity ${changingPhotoId === c.completion_media[0].id ? "opacity-40" : ""}`}
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
                            </>
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
                      <div className="px-3 py-2 flex items-center gap-2">
                        {/* User initial badge for shared goals */}
                        {isShared && (
                          <div
                            className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                            style={
                              c.user_id === user?.id
                                ? { background: chipColor + "20", color: chipColor, border: `1px solid ${chipColor}40` }
                                : { background: "var(--partner-light)", color: "var(--partner-accent)", border: "1px solid rgba(74,122,155,0.4)" }
                            }
                          >
                            {c.user_id === user?.id ? selfInitial : partnerInitial}
                          </div>
                        )}
                        {c.note && (
                          <p
                            className="text-[13px] text-[--foreground] flex-1 min-w-0"
                            dir={/[֐-׿؀-ۿ]/.test(c.note[0] ?? "") ? "rtl" : "ltr"}
                          >
                            {c.note}
                          </p>
                        )}
                        <p className="text-[11px] text-[--muted] ml-auto flex-shrink-0">
                          {format(new Date(c.completed_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
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
