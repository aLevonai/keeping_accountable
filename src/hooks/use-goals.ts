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
      .channel("goals-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "completions" },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [coupleId, load]);

  return { goals, loading, refetch: load };
}
