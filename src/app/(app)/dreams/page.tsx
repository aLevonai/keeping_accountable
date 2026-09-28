"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, Pencil, Trash2 } from "lucide-react";
import { useAppData } from "@/contexts/app-data";
import { useDreams } from "@/hooks/use-dreams";
import { useActions } from "@/lib/actions";
import { cn } from "@/utils/cn";
import type { DreamRow } from "@/types/database";
import { SectionDivider, PageTitle, firstName } from "@/components/ui/bits";
import { confirmSheet } from "@/components/ui/feedback";
import { AchieveDreamSheet } from "@/components/achieve-dream-sheet";

type StatusFilter = "active" | "achieved";

function DreamCard({
  dream,
  userId,
  partnerId,
  onAchieve,
}: {
  dream: DreamRow;
  userId: string;
  partnerId?: string;
  onAchieve: (d: DreamRow) => void;
}) {
  const { deleteDream, reopenDream } = useActions();
  const isShared = dream.owner_id === null;
  const isPartner = !!partnerId && dream.owner_id === partnerId;
  const isAchieved = dream.achieved_at !== null;
  const canEdit = isShared || dream.owner_id === userId;
  const dotColor = isShared ? "var(--primary)" : isPartner ? "var(--partner-accent)" : "var(--muted)";

  async function handleDelete() {
    const ok = await confirmSheet({ title: "Delete this dream?", confirmLabel: "Delete", destructive: true });
    if (ok) void deleteDream(dream);
  }

  async function handleReopen() {
    const hasMemory = !!(dream.achieved_photo_path || dream.achieved_note);
    if (hasMemory) {
      const ok = await confirmSheet({
        title: "Mark as not achieved?",
        message: "Its journal entry, photo and note will be removed.",
        confirmLabel: "Mark as open",
        destructive: true,
      });
      if (!ok) return;
    }
    void reopenDream(dream);
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-3.5 flex flex-col gap-2" style={{ opacity: isAchieved ? 0.75 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-[6px]" style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor }} />
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-medium text-foreground" dir="auto">{dream.title}</h3>
            {dream.note && <p className="text-[12px] text-muted mt-0.5 line-clamp-2" dir="auto">{dream.note}</p>}
            {isAchieved && (
              <Link href={`/journal?dream=${dream.id}`} className="inline-block text-[11px] text-primary font-medium mt-1">
                See it in the journal →
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canEdit && !isAchieved && (
            <>
              <Link
                href={`/dreams/${dream.id}/edit`}
                aria-label={`Edit ${dream.title}`}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-full text-muted active:scale-95 transition-transform"
              >
                <Pencil size={12} />
              </Link>
              <button
                onClick={handleDelete}
                aria-label={`Delete ${dream.title}`}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-full text-[#B83A26] active:scale-95 transition-transform"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
          {isAchieved ? (
            <div className="w-8 h-8 rounded-full bg-success-light flex items-center justify-center" aria-label="Achieved">
              <Check size={13} className="text-success" />
            </div>
          ) : (
            <button
              onClick={() => onAchieve(dream)}
              aria-label={`Mark ${dream.title} as achieved`}
              className="w-8 h-8 flex items-center justify-center border border-border rounded-full text-muted active:scale-95 transition-transform"
            >
              <Check size={13} />
            </button>
          )}
        </div>
      </div>

      {isAchieved && canEdit && (
        <button
          onClick={handleReopen}
          className="self-start text-[11px] text-muted underline underline-offset-2 active:opacity-60 transition-opacity ml-[18px]"
        >
          Mark as open
        </button>
      )}
    </div>
  );
}

function DreamsSkeleton() {
  return (
    <div className="flex flex-col gap-2 mt-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface rounded-2xl border border-border p-3.5 h-[72px] animate-pulse" />
      ))}
    </div>
  );
}

export default function DreamsPage() {
  const { user, partner, couple, loading: coupleLoading } = useAppData();
  const { dreams, loading: dreamsLoading } = useDreams(couple?.id);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [achieving, setAchieving] = useState<DreamRow | null>(null);

  const loading = !user || coupleLoading || dreamsLoading;
  const filtered = dreams.filter((d) => (filter === "active" ? d.achieved_at === null : d.achieved_at !== null));
  const sections = [
    { label: "Together", items: filtered.filter((d) => d.owner_id === null) },
    { label: "Yours", items: filtered.filter((d) => d.owner_id === user?.id) },
    { label: `${firstName(partner?.display_name, "Partner")}'s`, items: partner ? filtered.filter((d) => d.owner_id === partner.id) : [] },
  ];

  return (
    <div className="flex flex-col px-4 pt-14 pb-4">
      <div className="flex items-center justify-between px-1">
        <PageTitle>Dreams</PageTitle>
        <Link
          href="/dreams/new"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-white text-[13px] font-semibold active:scale-95 transition-transform duration-150"
        >
          <Plus size={14} />
          Add dream
        </Link>
      </div>

      <div className="flex gap-1.5 py-3 px-1" role="tablist">
        {(["active", "achieved"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors duration-150 border",
              filter === key ? "bg-primary text-white border-primary" : "bg-transparent text-muted border-border"
            )}
          >
            {key === "active" ? "Active" : "Achieved"}
          </button>
        ))}
      </div>

      {loading ? (
        <DreamsSkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <p className="text-muted text-sm">{filter === "active" ? "No dreams yet." : "Nothing achieved yet — soon."}</p>
          {filter === "active" && (
            <Link href="/dreams/new" className="text-primary font-semibold text-sm">Add one</Link>
          )}
        </div>
      ) : (
        <div>
          {sections.map(
            (s) =>
              s.items.length > 0 && (
                <div key={s.label}>
                  <SectionDivider label={s.label} count={s.items.length} />
                  <div className="flex flex-col gap-2">
                    {s.items.map((d) => (
                      <DreamCard key={d.id} dream={d} userId={user!.id} partnerId={partner?.id} onAchieve={setAchieving} />
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      )}

      <AchieveDreamSheet dream={achieving} onClose={() => setAchieving(null)} />
    </div>
  );
}
