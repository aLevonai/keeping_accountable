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

const ROTATIONS = [-1.5, 1.2, -0.8, 1.8, -1.2, 0.6];

function PolaroidCard({ entry, index }: { entry: JournalEntry; index: number }) {
  const rotation = ROTATIONS[index % ROTATIONS.length];
  const photo = entry.completion_media?.[0];
  const name = entry.users?.display_name ?? "Someone";
  const dayLabel = format(new Date(entry.completed_at), "EEE");
  const goalTitle = entry.goals?.title ?? "Goal";

  return (
    <div
      className="bg-white rounded-sm p-2 pb-6"
      style={{
        boxShadow: "0 2px 8px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.06)",
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {/* Photo area */}
      <div className="w-full aspect-square overflow-hidden bg-[--surface-alt]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPhotoUrl(photo.storage_path)}
            alt="Check-in"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-[--border]" />
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

  // Split into two columns
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
        <div className="flex gap-2.5 px-4">
          {/* Left column */}
          <div className="flex-1 flex flex-col gap-4">
            {leftEntries.map((entry, i) => (
              <PolaroidCard key={entry.id} entry={entry} index={i * 2} />
            ))}
          </div>
          {/* Right column (offset) */}
          <div className="flex-1 flex flex-col gap-4 pt-6">
            {rightEntries.map((entry, i) => (
              <PolaroidCard key={entry.id} entry={entry} index={i * 2 + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
