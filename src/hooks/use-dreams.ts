"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DreamRow } from "@/types/database";

export function useDreams(coupleId: string | null | undefined) {
  const [dreams, setDreams] = useState<DreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!coupleId) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("dreams")
      .select("*")
      .eq("couple_id", coupleId)
      .order("created_at", { ascending: false });

    setDreams((data as DreamRow[]) ?? []);
    setLoading(false);
  }, [coupleId]);

  useEffect(() => {
    load();

    if (!coupleId) return;

    const channel = supabase
      .channel("dreams-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "dreams" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [coupleId, load]);

  return { dreams, loading, refetch: load };
}
