"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";
import { getPhotoUrl } from "@/utils/storage";
import { format } from "date-fns";
import { JournalSkeleton } from "@/components/ui/page-skeleton";

interface JournalEntry {
  id: string;
  note: string | null;
  completed_at: string;
  goals: { title: string } | null;
  users: { display_name: string } | null;
  completion_media: { storage_path: string }[];
}

const ROTATIONS = [-1.5, 1.2, -0.8, 1.8, -1.2, 0.6, -0.4, 1.6, -1.0, 0.9];
// Alternating aspect ratios: square, wide, tall, wide, square, tall…
const ASPECTS = ["aspect-square", "aspect-[4/3]", "aspect-[3/4]", "aspect-[4/3]", "aspect-square", "aspect-[3/4]"];
// Subtle gradient backgrounds for entries without photos
const GRAD_BG = [
  "linear-gradient(135deg, #f5e6d8 0%, #e8d5c4 100%)",
  "linear-gradient(135deg, #dce8f0 0%, #c8dce8 100%)",
  "linear-gradient(135deg, #e8e4f0 0%, #d8d2e8 100%)",
  "linear-gradient(135deg, #d8ece0 0%, #c8e0d0 100%)",
  "linear-gradient(135deg, #f0ece0 0%, #e4dcc8 100%)",
  "linear-gradient(135deg, #ece0e8 0%, #dcc8d8 100%)",
];

function TapeStrip({ angle = 0 }: { angle?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: -8,
        left: "50%",
        transform: `translateX(-50%) rotate(${angle}deg)`,
        width: 44,
        height: 18,
        background: "rgba(255,230,180,0.55)",
        borderRadius: 2,
        zIndex: 2,
        backdropFilter: "blur(0px)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    />
  );
}

function PolaroidCard({ entry, index }: { entry: JournalEntry; index: number }) {
  const rotation = ROTATIONS[index % ROTATIONS.length];
  const aspectClass = ASPECTS[index % ASPECTS.length];
  const gradBg = GRAD_BG[index % GRAD_BG.length];
  const tapeAngle = (index % 3 === 0) ? -4 : (index % 3 === 1) ? 3 : -2;

  const photo = entry.completion_media?.[0];
  const name = entry.users?.display_name ?? "Someone";
  const dayLabel = format(new Date(entry.completed_at), "EEE");
  const goalTitle = entry.goals?.title ?? "Goal";

  return (
    <div
      className="relative bg-white rounded-sm p-2 pb-7"
      style={{
        boxShadow: "0 3px 12px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)",
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <TapeStrip angle={tapeAngle} />

      {/* Photo area */}
      <div className={`w-full ${aspectClass} overflow-hidden bg-[--surface-alt] relative`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPhotoUrl(photo.storage_path)}
            alt="Check-in"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: gradBg }}
          >
            <div className="w-8 h-8 rounded-full bg-white/30" />
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="pt-2 px-0.5">
        <p className="text-[10px] font-semibold text-[#666] uppercase tracking-[0.05em]">
          {name} · {dayLabel}
        </p>
        <p className="text-[10px] text-[#999] mt-0.5 truncate">{goalTitle}</p>
        {entry.note && (
          <p className="text-[10px] italic text-[#777] mt-1 line-clamp-2">&ldquo;{entry.note}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

export default function JournalPage() {
  const { user } = useAuth();
  const { couple } = useCouple(user?.id);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!couple) return;

    async function load() {
      const { data } = await supabase
        .from("completions")
        .select("id, note, completed_at, goals!inner(title, couple_id), users(display_name), completion_media(storage_path)")
        .eq("goals.couple_id", couple!.id)
        .order("completed_at", { ascending: false })
        .limit(100);

      setEntries((data ?? []) as unknown as JournalEntry[]);
      setLoading(false);
    }

    load();
  }, [couple?.id]);

  if (loading) {
    return <JournalSkeleton />;
  }

  const monthLabel = entries.length > 0
    ? format(new Date(entries[0].completed_at), "MMMM yyyy")
    : format(new Date(), "MMMM yyyy");

  const leftEntries = entries.filter((_, i) => i % 2 === 0);
  const rightEntries = entries.filter((_, i) => i % 2 !== 0);

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground]">Journal</h1>
        <p className="text-[12px] text-[--muted] mt-0.5">{monthLabel}</p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-[--muted] text-sm px-5">
          No check-ins yet. Complete a goal to see it here.
        </div>
      ) : (
        <div className="flex gap-2.5 px-4 pt-3">
          {/* Left column */}
          <div className="flex-1 flex flex-col gap-5">
            {leftEntries.map((entry, i) => (
              <PolaroidCard key={entry.id} entry={entry} index={i * 2} />
            ))}
          </div>
          {/* Right column (offset) */}
          <div className="flex-1 flex flex-col gap-5 pt-8">
            {rightEntries.map((entry, i) => (
              <PolaroidCard key={entry.id} entry={entry} index={i * 2 + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
