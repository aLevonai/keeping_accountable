"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";
import { getPhotoUrl } from "@/utils/storage";
import { format } from "date-fns";

interface JournalEntry {
  id: string;
  note: string | null;
  completed_at: string;
  goals: { title: string }[] | { title: string } | null;
  users: { display_name: string }[] | { display_name: string } | null;
  completion_media: { storage_path: string }[];
}

function goalTitle(entry: JournalEntry): string {
  if (!entry.goals) return "Goal";
  if (Array.isArray(entry.goals)) return entry.goals[0]?.title ?? "Goal";
  return entry.goals.title;
}

function userName(entry: JournalEntry): string {
  if (!entry.users) return "Someone";
  if (Array.isArray(entry.users)) return entry.users[0]?.display_name ?? "Someone";
  return entry.users.display_name;
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
      // First fetch goal IDs for this couple
      const { data: goalRows } = await supabase
        .from("goals")
        .select("id")
        .eq("couple_id", couple!.id);

      const goalIds = (goalRows ?? []).map((g: { id: string }) => g.id);
      if (goalIds.length === 0) { setLoading(false); return; }

      const { data } = await supabase
        .from("completions")
        .select("id, note, completed_at, goals(title), users(display_name), completion_media(storage_path)")
        .in("goal_id", goalIds)
        .order("completed_at", { ascending: false })
        .limit(100);

      setEntries((data ?? []) as unknown as JournalEntry[]);
      setLoading(false);
    }

    load();
  }, [couple?.id]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>;
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Journal</h1>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No check-ins yet. Complete a goal to see it here.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded overflow-hidden">
              {entry.completion_media?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getPhotoUrl(entry.completion_media[0].storage_path)}
                  alt="Check-in photo"
                  className="w-full max-h-72 object-cover"
                />
              )}
              <div className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">{goalTitle(entry)}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {format(new Date(entry.completed_at), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{userName(entry)}</p>
                {entry.note && <p className="text-sm text-gray-700 mt-1">{entry.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
