"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, Check, Pencil, Trash2 } from "lucide-react";
import { useAppData } from "@/contexts/app-data";
import { useDreams } from "@/hooks/use-dreams";
import { useActions } from "@/lib/actions";
import { seeded, between } from "@/utils/seeded";
import type { DreamRow } from "@/types/database";
import { firstName, getInitial } from "@/components/ui/bits";
import { PaperPage, PaperHeader, HandHeading, PostageStamp, Postmark, Pin } from "@/components/ui/paper";
import { confirmSheet } from "@/components/ui/feedback";
import { AchieveDreamSheet } from "@/components/achieve-dream-sheet";

// Dreams as postcards: a stamp in the owner's colour, the dream in serif, the
// note in handwriting — and a postmark once it comes true.

type StatusFilter = "active" | "achieved";

function DreamPostcard({
  dream,
  userId,
  partnerName,
  selfName,
  onAchieve,
}: {
  dream: DreamRow;
  userId: string;
  partnerName: string;
  selfName: string;
  onAchieve: (d: DreamRow) => void;
}) {
  const { deleteDream, reopenDream } = useActions();
  const r = seeded(dream.id + ":postcard");
  const isShared = dream.owner_id === null;
  const isMine = dream.owner_id === userId;
  const isAchieved = dream.achieved_at !== null;
  const canEdit = isShared || isMine;
  const stampColor = isShared ? "var(--primary)" : isMine ? "#8A7B6E" : "var(--partner-accent)";
  const owner = isShared ? "together" : isMine ? "yours" : `${partnerName}'s`;
  const stampLetter = isShared ? "✦" : getInitial(isMine ? selfName : partnerName);

  async function handleDelete() {
    const ok = await confirmSheet({ title: "Delete this dream?", confirmLabel: "Delete", destructive: true });
    if (ok) void deleteDream(dream);
  }

  async function handleReopen() {
    if (dream.achieved_photo_path || dream.achieved_note) {
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
    <article className="relative mx-5 mb-7" style={{ transform: `rotate(${between(r, -1.6, 1.6)}deg)` }}>
      <div className="relative bg-[#FBF6EE] px-4 pt-4 pb-3.5 shadow-[0_2px_5px_rgba(60,40,20,0.13),0_14px_22px_-14px_rgba(60,40,20,0.35)]">
        {/* Postcard divider + address lines on the right half */}
        <div aria-hidden className="absolute top-4 bottom-14 left-[60%] w-px bg-[rgba(138,115,94,0.25)]" />
        <div aria-hidden className="absolute right-4 left-[64%] top-[78px] flex flex-col gap-[14px]">
          {[0, 1, 2].map((i) => <div key={i} className="h-px bg-[rgba(138,115,94,0.22)]" />)}
        </div>

        <div className="absolute top-3 right-4">
          <PostageStamp color={stampColor} rotate={between(r, 2, 7)}>{stampLetter}</PostageStamp>
          {isAchieved && dream.achieved_at && (
            <Postmark
              label="ACHIEVED"
              date={format(new Date(dream.achieved_at), "d MMM yy").toUpperCase()}
              className="absolute -top-5 -left-12"
            />
          )}
        </div>

        <div className="w-[58%] min-h-[96px]">
          <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-[#8A735E]">{owner}</p>
          <h3
            className={`font-[family-name:var(--font-instrument-serif)] italic text-[25px] leading-[1.05] mt-1 ${isAchieved ? "text-[#6E6053]" : "text-[#2B221B]"}`}
            dir="auto"
          >
            {dream.title}
          </h3>
          {dream.note && (
            <p className="font-hand text-[18px] leading-[1.15] text-[#5A4E44] mt-1.5 line-clamp-3" dir="auto">
              {dream.note}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-dashed border-[rgba(138,115,94,0.35)]">
          {isAchieved ? (
            <>
              <Link href={`/journal?dream=${dream.id}`} className="font-hand text-[18px] leading-none text-primary">
                see it in the journal →
              </Link>
              {canEdit && (
                <button onClick={handleReopen} className="ml-auto text-[11px] text-muted underline underline-offset-2 active:opacity-60">
                  mark as open
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => onAchieve(dream)}
                className="flex items-center gap-1.5 rounded-full border-[1.5px] border-primary/70 text-primary px-3 py-1 active:scale-95 transition-transform"
                aria-label={`Mark ${dream.title} as achieved`}
              >
                <Check size={13} />
                <span className="font-hand text-[18px] leading-none">we did it</span>
              </button>
              {canEdit && (
                <div className="ml-auto flex items-center gap-1.5">
                  <Link
                    href={`/dreams/${dream.id}/edit`}
                    aria-label={`Edit ${dream.title}`}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-[#8A735E] active:bg-black/5"
                  >
                    <Pencil size={14} />
                  </Link>
                  <button
                    onClick={handleDelete}
                    aria-label={`Delete ${dream.title}`}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-[#B83A26] active:bg-black/5"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function DreamsSkeleton() {
  return (
    <div className="flex flex-col gap-6 mt-8 px-5">
      {[1, 2].map((i) => (
        <div key={i} className="bg-[#FBF6EE] h-[150px] animate-pulse shadow-sm" />
      ))}
    </div>
  );
}

export default function DreamsPage() {
  const { user, partner, self, couple, loading: coupleLoading } = useAppData();
  const { dreams, loading: dreamsLoading } = useDreams(couple?.id);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [achieving, setAchieving] = useState<DreamRow | null>(null);

  const loading = !user || coupleLoading || dreamsLoading;
  const filtered = dreams.filter((d) => (filter === "active" ? d.achieved_at === null : d.achieved_at !== null));
  const partnerName = firstName(partner?.display_name, "Partner");
  const sections = [
    { label: "together", items: filtered.filter((d) => d.owner_id === null) },
    { label: "yours", items: filtered.filter((d) => d.owner_id === user?.id) },
    { label: `${partnerName}'s`, items: partner ? filtered.filter((d) => d.owner_id === partner.id) : [] },
  ];
  const counts = {
    active: dreams.filter((d) => d.achieved_at === null).length,
    achieved: dreams.filter((d) => d.achieved_at !== null).length,
  };

  return (
    <PaperPage>
      <PaperHeader
        title="Dreams"
        subtitle="places we'll go, things we'll do"
        action={
          <Link
            href="/dreams/new"
            aria-label="Add a dream"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white shadow-[0_3px_8px_rgba(196,112,79,0.35)] active:scale-95 transition-transform"
          >
            <Plus size={19} />
          </Link>
        }
      />

      {/* File-folder tabs */}
      <div className="flex gap-1 px-5 mt-6 border-b border-[rgba(138,115,94,0.3)]" role="tablist">
        {(["active", "achieved"] as const).map((key) => {
          const on = filter === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(key)}
              className={`relative -mb-px px-4 pt-2 pb-1.5 rounded-t-[10px] border border-b-0 transition-colors ${
                on ? "bg-[#FBF6EE] border-[rgba(138,115,94,0.3)]" : "bg-transparent border-transparent"
              }`}
            >
              <span className={`font-hand text-[21px] leading-none ${on ? "text-[#3B332C]" : "text-muted"}`}>
                {key === "active" ? "someday" : "came true"}
              </span>
              <span className="font-mono text-[9px] text-muted ml-1.5">{counts[key]}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <DreamsSkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex justify-center pt-14">
          <div className="relative bg-[#FFF1B8] px-6 pt-7 pb-5 rotate-2 shadow-[0_14px_18px_-14px_rgba(60,40,20,0.45)] max-w-[250px] text-center">
            <Pin className="top-2 left-1/2 -translate-x-1/2" />
            <p className="font-hand text-[24px] leading-tight text-[#3B332C]">
              {filter === "active" ? "No dreams yet." : "Nothing's come true yet — soon."}
            </p>
            {filter === "active" && (
              <Link href="/dreams/new" className="font-hand text-[19px] text-primary mt-1 inline-block">write the first one →</Link>
            )}
          </div>
        </div>
      ) : (
        sections.map(
          (s) =>
            s.items.length > 0 && (
              <section key={s.label}>
                <HandHeading count={s.items.length} className="mt-8 mb-4">{s.label}</HandHeading>
                {s.items.map((d) => (
                  <DreamPostcard
                    key={d.id}
                    dream={d}
                    userId={user!.id}
                    partnerName={partnerName}
                    selfName={firstName(self?.display_name, "You")}
                    onAchieve={setAchieving}
                  />
                ))}
              </section>
            )
        )
      )}

      <AchieveDreamSheet dream={achieving} onClose={() => setAchieving(null)} />
    </PaperPage>
  );
}
