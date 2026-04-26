"use client";

import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import { useDreams } from "@/hooks/use-dreams";
import Link from "next/link";
import { Plus, Check, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";
import type { DreamRow } from "@/types/database";

type StatusFilter = "active" | "achieved";

function DreamCard({
  dream,
  userId,
  partnerId,
  partnerName,
  onUpdate,
}: {
  dream: DreamRow;
  userId: string;
  partnerId: string;
  partnerName: string;
  onUpdate: () => void;
}) {
  const supabase = createClient();
  const isShared = dream.owner_id === null;
  const isPartner = dream.owner_id === partnerId;
  const isAchieved = dream.achieved_at !== null;
  const canEdit = dream.owner_id === null || dream.owner_id === userId;

  async function markAchieved() {
    await supabase
      .from("dreams")
      .update({ achieved_at: new Date().toISOString() })
      .eq("id", dream.id);
    onUpdate();
  }

  async function markOpen() {
    await supabase
      .from("dreams")
      .update({ achieved_at: null })
      .eq("id", dream.id);
    onUpdate();
  }

  async function handleDelete() {
    if (!window.confirm("Delete this dream? This cannot be undone.")) return;
    await supabase.from("dreams").delete().eq("id", dream.id);
    onUpdate();
  }

  return (
    <div className="bg-[--surface] rounded-2xl border border-[--border] p-3.5 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="text-[20px] leading-none mt-0.5 flex-shrink-0">{dream.emoji}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-medium text-[--foreground]">{dream.title}</h3>
            {isShared && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[--primary]">Shared</span>
            )}
            {isPartner && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[--muted]">Partner</span>
            )}
            {dream.note && (
              <p className="text-[12px] text-[--muted] mt-0.5 line-clamp-2">{dream.note}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canEdit && (
            <>
              <Link
                href={`/dreams/${dream.id}/edit`}
                className="w-7 h-7 flex items-center justify-center border border-[--border] rounded-full bg-transparent text-[--muted] active:scale-95 transition-transform"
              >
                <Pencil size={12} />
              </Link>
              <button
                onClick={handleDelete}
                className="w-7 h-7 flex items-center justify-center border border-[--border] rounded-full bg-transparent text-red-400 active:scale-95 transition-transform"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
          {isAchieved ? (
            <div className="w-7 h-7 rounded-full bg-[--success-light] flex items-center justify-center">
              <Check size={13} className="text-[--success]" />
            </div>
          ) : (
            <button
              onClick={markAchieved}
              className="w-7 h-7 flex items-center justify-center border border-[--border] rounded-full bg-transparent text-[--muted] active:scale-95 transition-transform"
            >
              <Check size={13} />
            </button>
          )}
        </div>
      </div>

      {isAchieved && (
        <button
          onClick={markOpen}
          className="self-start text-[11px] text-[--muted] underline underline-offset-2 active:opacity-60 transition-opacity"
        >
          Mark as open
        </button>
      )}
    </div>
  );
}

function DreamsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-[--surface] rounded-2xl border border-[--border] p-3.5 h-[72px] animate-pulse" />
      ))}
    </div>
  );
}

export default function DreamsPage() {
  const { user } = useAuth();
  const { partner, couple, loading: coupleLoading } = useAppData();
  const { dreams, loading: dreamsLoading, refetch } = useDreams(couple?.id);
  const [filter, setFilter] = useState<StatusFilter>("active");

  const loading = !user || coupleLoading || dreamsLoading;

  if (loading) {
    return (
      <div className="flex flex-col px-5 pt-14 gap-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-20 bg-[--border] rounded-xl animate-pulse" />
          <div className="w-9 h-9 rounded-full bg-[--border] animate-pulse" />
        </div>
        <DreamsSkeleton />
      </div>
    );
  }

  const filtered = dreams.filter((d) =>
    filter === "active" ? d.achieved_at === null : d.achieved_at !== null
  );

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "achieved", label: "Achieved" },
  ];

  return (
    <div className="flex flex-col px-5 pt-14 gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground]">
          Dreams
        </h1>
        <Link
          href="/dreams/new"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[--primary] text-[--foreground] active:scale-95 transition-transform duration-150"
        >
          <Plus size={18} />
        </Link>
      </div>

      <div className="flex gap-1.5">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors duration-150",
              filter === key
                ? "bg-[--primary] text-[--foreground] border border-[--primary]"
                : "bg-transparent text-[--muted] border border-[--border]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <p className="text-[--muted] text-sm">
            {filter === "active" ? "No dreams yet." : "Nothing achieved yet."}
          </p>
          {filter === "active" && (
            <Link href="/dreams/new" className="text-[--primary] font-semibold text-sm">
              Add one
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((d) => (
            <DreamCard
              key={d.id}
              dream={d}
              userId={user!.id}
              partnerId={partner?.id ?? ""}
              partnerName={partner?.display_name ?? "Partner"}
              onUpdate={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
