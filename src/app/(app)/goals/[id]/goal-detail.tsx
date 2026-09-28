"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Camera, Pencil, ImagePlus, MoreHorizontal } from "lucide-react";
import { useAppData } from "@/contexts/app-data";
import { useGoal, useGoalHistory } from "@/hooks/use-goal";
import { useActions, useIsUploading } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { getPeriodLabel, calculateStreak, getStreakHistory, getPeriodRange } from "@/utils/period";
import { goalProgress, cadenceUnit } from "@/utils/goal-progress";
import type { Cadence, CompletionWithMedia } from "@/types/database";
import { GoalDetailSkeleton } from "@/components/ui/page-skeleton";
import { Avatar, BackButton, firstName } from "@/components/ui/bits";
import { Photo } from "@/components/ui/photo";
import { NotebookCard, Tape, Tapes, HandHeading } from "@/components/ui/paper";
import { seeded, between } from "@/utils/seeded";
import { Sheet } from "@/components/ui/sheet";
import { confirmSheet, toast } from "@/components/ui/feedback";

interface PeriodGroup {
  key: string;
  label: string;
  items: CompletionWithMedia[];
}

// Completions arrive newest first, so groups come out newest first too.
function groupByPeriod(completions: CompletionWithMedia[], cadence: Cadence): PeriodGroup[] {
  if (completions.length === 0) return [];
  if (cadence === "once") return [{ key: "all", label: "All time", items: completions }];

  const groups = new Map<string, PeriodGroup>();
  for (const c of completions) {
    const range = getPeriodRange(cadence, new Date(c.completed_at))!;
    const key = range.start.toISOString();
    if (!groups.has(key)) {
      const label =
        cadence === "daily" ? format(range.start, "EEE, MMM d")
        : cadence === "weekly" ? `Week of ${format(range.start, "MMM d")}`
        : cadence === "monthly" ? format(range.start, "MMMM yyyy")
        : format(range.start, "yyyy");
      groups.set(key, { key, label, items: [] });
    }
    groups.get(key)!.items.push(c);
  }
  return [...groups.values()];
}

function StreakCalendar({
  completions,
  cadence,
  target,
  color,
  badge,
}: {
  completions: { completed_at: string }[];
  cadence: Cadence;
  target: number;
  color: string;
  badge?: React.ReactNode;
}) {
  const periodCount = cadence === "daily" ? 14 : cadence === "weekly" ? 8 : cadence === "monthly" ? 6 : 3;
  const history = getStreakHistory(completions, cadence, target, periodCount);
  const streak = calculateStreak(completions, cadence, target);

  return (
    <div className="mt-3">
      {(badge || streak >= 2) && (
        <div className="flex items-center gap-1.5 mb-1.5">
          {badge}
          {streak >= 2 && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: badge ? "var(--muted)" : color }}>
              {streak} {cadenceUnit(cadence)} streak
            </span>
          )}
        </div>
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
              background: p.met ? color : p.inProgress ? `color-mix(in srgb, ${color} 20%, transparent)` : "var(--border)",
              border: p.inProgress && !p.met ? `1.5px solid color-mix(in srgb, ${color} 40%, transparent)` : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ label, count, target, periodLabel, color }: { label: string; count: number; target: number; periodLabel: string; color: string }) {
  const done = count >= target;
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-foreground">{label}{count} of {target} {periodLabel}</span>
        <span className="text-[13px] text-muted">{done ? "Done" : `${target - count} to go`}</span>
      </div>
      <div className="h-[4px] rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(count / target, 1) * 100}%`, backgroundColor: done ? "var(--success)" : color }}
        />
      </div>
    </>
  );
}

function HistoryCard({
  c,
  isOwn,
  showAuthor,
  chipColor,
  selfName,
  partnerName,
  onActions,
}: {
  c: CompletionWithMedia;
  isOwn: boolean;
  showAuthor: boolean;
  chipColor: string;
  selfName?: string;
  partnerName?: string;
  onActions: () => void;
}) {
  const media = c.completion_media?.[0];
  const uploading = useIsUploading(c.id);
  const aspect = media?.width && media?.height ? `${media.width} / ${media.height}` : "4 / 3";
  const r = seeded(c.id + ":history");

  return (
    <div
      className={`relative ${media || uploading ? "bg-white p-2 pb-1" : "bg-[#FFFDF8]"} shadow-[0_2px_5px_rgba(60,40,20,0.12),0_10px_18px_-12px_rgba(60,40,20,0.3)]`}
      style={{
        transform: `rotate(${between(r, -1.4, 1.4)}deg)`,
        ...(media || uploading ? {} : { backgroundImage: "repeating-linear-gradient(#FFFDF8 0 23px, rgba(120,160,200,0.25) 23px 24px)" }),
      }}
    >
      {media ? (
        <>
          <Tapes r={r} />
          <div className="relative bg-[#EDE6DD] max-h-[420px] overflow-hidden" style={{ aspectRatio: aspect }}>
            <Photo path={media.storage_path} alt="Check-in photo" className="w-full h-full object-cover" />
          </div>
        </>
      ) : uploading ? (
        <div className="py-6 text-center font-hand text-[18px] text-muted bg-gradient-to-br from-[#E7E1DA] to-[#CFC6BC] animate-pulse">developing…</div>
      ) : null}
      <div className="px-2 py-2 flex items-center gap-2">
        {showAuthor && (
          <Avatar name={isOwn ? selfName : partnerName} who={isOwn ? "self" : "partner"} color={chipColor} />
        )}
        {c.note ? (
          <p className="font-hand text-[18px] leading-tight text-[#3B332C] flex-1 min-w-0" dir="auto">{c.note}</p>
        ) : (
          <p className="font-hand text-[17px] leading-tight text-[#8A7B6E] flex-1 min-w-0">checked in</p>
        )}
        <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-muted flex-shrink-0">{format(new Date(c.completed_at), "EEE d MMM · HH:mm")}</p>
        {isOwn && (
          <button
            onClick={onActions}
            aria-label="Check-in options"
            className="w-7 h-7 -mr-1 flex items-center justify-center rounded-full text-muted active:bg-surface-alt flex-shrink-0"
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export function GoalDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user, partner, self } = useAppData();
  const { goal, loading, notFound } = useGoal(id);
  const history = useGoalHistory(id);
  const actions = useActions();
  const [nudgeSent, setNudgeSent] = useState(false);
  const [menuFor, setMenuFor] = useState<CompletionWithMedia | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTarget = useRef<CompletionWithMedia | null>(null);

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3 px-6 text-center">
        <p className="text-muted text-sm">Goal not found.</p>
        <Link href="/goals" className="text-sm text-primary font-semibold underline">Back to goals</Link>
      </div>
    );
  }
  if (loading || !goal) return <GoalDetailSkeleton />;

  const p = goalProgress(goal, user?.id, partner?.id);
  const chipColor = goal.color ?? "var(--primary)";
  const periodLabel = getPeriodLabel(goal.cadence);
  const isOwnerOrShared = goal.owner_id === null || goal.owner_id === user?.id;
  const canNudge = !!partner && (goal.owner_id === partner.id || goal.owner_id === null);
  const myComps = goal.completions.filter((c) => c.user_id === user?.id);
  const partnerComps = partner ? goal.completions.filter((c) => c.user_id === partner.id) : [];
  const periodGroups = groupByPeriod(history.data ?? [], goal.cadence);
  const partnerFirst = firstName(partner?.display_name, "Partner");

  const ownerLabel =
    goal.owner_id === null ? (goal.is_joint ? "Together as one" : "Shared goal")
    : goal.owner_id === user?.id ? "Your goal"
    : `${partnerFirst}'s goal`;

  async function handleNudge() {
    setNudgeSent(true);
    try {
      await createClient().functions.invoke("send-push", {
        body: {
          title: "CheckMate",
          body: `Time to work on "${goal!.title}"! ${firstName(self?.display_name, "Your partner")} is rooting for you.`,
          url: `/goals/${goal!.id}`,
        },
      });
      toast(`Nudged ${partnerFirst}`);
    } catch {
      toast("Couldn't send the nudge.", { tone: "error" });
    }
    setTimeout(() => setNudgeSent(false), 3000);
  }

  async function handleArchive() {
    await actions.archiveGoal(goal!);
    router.replace("/goals");
  }

  async function handleDelete() {
    const ok = await confirmSheet({
      title: "Delete this goal?",
      message: "All of its check-ins and photos will be permanently deleted.",
      confirmLabel: "Delete goal",
      destructive: true,
    });
    if (!ok) return;
    router.replace("/goals");
    await actions.deleteGoal(goal!);
  }

  function pickPhoto(c: CompletionWithMedia) {
    photoTarget.current = c;
    setMenuFor(null);
    photoInputRef.current?.click();
  }

  function handlePhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const c = photoTarget.current;
    e.target.value = "";
    if (!file || !c) return;
    void actions.attachPhoto(c.id, goal!.id, file, { replace: c.completion_media?.[0] });
  }

  async function handleDeleteCheckIn(c: CompletionWithMedia) {
    setMenuFor(null);
    const ok = await confirmSheet({
      title: "Delete this check-in?",
      message: c.completion_media?.length ? "Its photo will be deleted too." : undefined,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) await actions.deleteCheckIn(c);
  }

  return (
    <div className="paper-bg flex flex-col min-h-screen pb-40 -mb-24">
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPicked} />

      <div className="px-5 pt-14 pb-2">
        <div className="flex items-center justify-between mb-4">
          <BackButton fallback="/goals" className="" />
          {isOwnerOrShared && (
            <Link
              href={`/goals/${goal.id}/edit`}
              aria-label="Edit goal"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#FFFDF8] shadow-[0_1px_3px_rgba(60,40,20,0.15)] active:scale-95 transition-transform"
            >
              <Pencil size={15} className="text-muted" />
            </Link>
          )}
        </div>

        <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted">{ownerLabel} · {goal.cadence}</p>
        <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[32px] text-foreground leading-[1.05] mt-1" dir="auto">
          {goal.title}
        </h1>

        {goal.cadence !== "once" && (
          <NotebookCard className="mt-5 px-4 pt-4 pb-4" tilt={-0.6}>
            <Tape r={seeded(goal.id + ":progress")} style={{ top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64 }} />
            <ProgressBar
              label={p.mode === "separate" ? "You · " : ""}
              count={p.mode === "separate" ? p.myCount : p.total}
              target={p.target}
              periodLabel={periodLabel}
              color={chipColor}
            />
            {p.mode === "separate" && partner && (
              <div className="mt-3">
                <ProgressBar
                  label={`${partnerFirst} · `}
                  count={p.partnerCount}
                  target={p.target}
                  periodLabel={periodLabel}
                  color="var(--partner-accent)"
                />
              </div>
            )}

            {p.mode === "separate" ? (
              <div className="mt-1 flex flex-col">
                <StreakCalendar
                  completions={myComps}
                  cadence={goal.cadence}
                  target={p.target}
                  color={chipColor}
                  badge={<Avatar name={self?.display_name} who="self" size={14} color={chipColor} />}
                />
                {partner && (
                  <StreakCalendar
                    completions={partnerComps}
                    cadence={goal.cadence}
                    target={p.target}
                    color="var(--partner-accent)"
                    badge={<Avatar name={partner.display_name} who="partner" size={14} />}
                  />
                )}
              </div>
            ) : (
              <StreakCalendar
                completions={goal.completions}
                cadence={goal.cadence}
                target={p.target}
                color={p.done ? "var(--success)" : chipColor}
              />
            )}
          </NotebookCard>
        )}
      </div>

      <div className="px-5 py-5 flex flex-col gap-2">
        {isOwnerOrShared && (
          <Link
            href={`/check-in/${goal.id}`}
            className="flex items-center justify-center gap-2 w-full text-white font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform text-[15px] shadow-sm"
            style={{ background: goal.color && goal.color !== "#374151" ? goal.color : "var(--primary)" }}
          >
            <Camera size={18} />
            Check in with a photo
          </Link>
        )}
        {canNudge && (
          <button
            onClick={handleNudge}
            disabled={nudgeSent}
            className="flex items-center justify-center gap-2 w-full bg-[#DCE8F2] text-[#2F4A5E] py-3 rounded-2xl shadow-[0_1px_3px_rgba(40,60,80,0.15)] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            <span className="font-hand text-[20px] leading-none">{nudgeSent ? "nudge sent ✓" : `nudge ${partnerFirst}`}</span>
          </button>
        )}
      </div>

      <div className="flex flex-col px-5 py-2 gap-1 pb-8">
        <HandHeading className="mt-3 mb-4 -mx-6">history</HandHeading>

        {history.isPending && goal.completions.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {goal.completions.slice(-3).map((c) => (
              <div key={c.id} className="h-12 bg-[#FFFDF8] shadow-sm animate-pulse" />
            ))}
          </div>
        ) : periodGroups.length === 0 ? (
          <p className="font-hand text-[21px] text-muted text-center py-6">No check-ins yet. Be the first!</p>
        ) : (
          <div className="flex flex-col gap-6">
            {periodGroups.map((group) => (
              <div key={group.key}>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-hand text-[21px] leading-none text-[#3B332C]">{group.label}</span>
                  <span className="font-mono text-[9px] tracking-[0.14em] text-muted">
                    {group.items.length}/{p.target}
                  </span>
                </div>
                <div className="flex flex-col gap-4">
                  {group.items.map((c) => (
                    <HistoryCard
                      key={c.id}
                      c={c}
                      isOwn={c.user_id === user?.id}
                      showAuthor={p.isShared}
                      chipColor={chipColor}
                      selfName={self?.display_name}
                      partnerName={partner?.display_name}
                      onActions={() => setMenuFor(c)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwnerOrShared && (
        <div className="px-5 pb-8 mt-auto flex flex-col items-center gap-1">
          <button onClick={handleArchive} className="text-muted text-xs py-2 px-4 active:opacity-60">Archive this goal</button>
          <button onClick={handleDelete} className="text-[#B83A26] text-xs py-2 px-4 active:opacity-60">Delete this goal</button>
        </div>
      )}

      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} label="Check-in options">
        {menuFor && (
          <div className="px-3 pb-1 flex flex-col">
            <button
              onClick={() => pickPhoto(menuFor)}
              className="flex items-center gap-3 px-3 py-3.5 text-[15px] text-foreground rounded-xl active:bg-surface-alt"
            >
              <ImagePlus size={18} className="text-muted" />
              {menuFor.completion_media?.length ? "Change photo" : "Add photo"}
            </button>
            {menuFor.completion_media?.[0] && (
              <button
                onClick={() => {
                  const media = menuFor.completion_media[0];
                  setMenuFor(null);
                  void actions.removePhoto(menuFor.id, goal.id, media);
                }}
                className="flex items-center gap-3 px-3 py-3.5 text-[15px] text-foreground rounded-xl active:bg-surface-alt"
              >
                <Camera size={18} className="text-muted" />
                Remove photo
              </button>
            )}
            <button
              onClick={() => handleDeleteCheckIn(menuFor)}
              className="flex items-center gap-3 px-3 py-3.5 text-[15px] text-[#B83A26] rounded-xl active:bg-surface-alt"
            >
              <span className="w-[18px] text-center">×</span>
              Delete check-in
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
