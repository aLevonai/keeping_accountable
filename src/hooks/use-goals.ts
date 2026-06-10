"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GoalRow, CompletionRow } from "@/types/database";

export type GoalWithCompletions = GoalRow & {
  completions: CompletionRow[];
};

export function useGoals(coupleId: string | null | undefined) {
  const [goals, setGoals] = useState<GoalWithCompletions[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!coupleId) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("goals")
      .select("*, completions(*)")
      .eq("couple_id", coupleId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    setGoals((data as GoalWithCompletions[]) ?? []);
    setLoading(false);
  }, [coupleId]);

  useEffect(() => {
    load();

    if (!coupleId) return;

    const channel = supabase
      .channel(`goals-realtime-${coupleId}`)
      // Goals change rarely — filter to this couple and do a full reload.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals", filter: `couple_id=eq.${coupleId}` },
        () => load()
      )
      // Completions have no couple_id to filter on, so subscribe broadly but
      // patch local state from the payload — and ignore events for goals that
      // aren't ours — instead of reloading everything on every check-in.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "completions" },
        (payload) => {
          setGoals((prev) => {
            const goalIds = new Set(prev.map((g) => g.id));
            if (payload.eventType === "INSERT") {
              const row = payload.new as CompletionRow;
              if (!goalIds.has(row.goal_id)) return prev;
              return prev.map((g) =>
                g.id === row.goal_id ? { ...g, completions: [...g.completions, row] } : g
              );
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as CompletionRow;
              if (!goalIds.has(row.goal_id)) return prev;
              return prev.map((g) =>
                g.id === row.goal_id
                  ? { ...g, completions: g.completions.map((c) => (c.id === row.id ? row : c)) }
                  : g
              );
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<CompletionRow>;
              if (!oldRow.id) return prev;
              return prev.map((g) => ({
                ...g,
                completions: g.completions.filter((c) => c.id !== oldRow.id),
              }));
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [coupleId, load]);

  return { goals, loading, refetch: load };
}
