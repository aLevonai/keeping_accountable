"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  qk,
  fetchCouple,
  fetchGoals,
  fetchDreams,
  fetchJournalPage,
  type SessionUser,
} from "@/lib/queries";
import type { CoupleRow, UserRow, GoalWithCompletions, CompletionLite } from "@/types/database";

interface AppData {
  user: SessionUser | null;
  couple: CoupleRow | null;
  self: UserRow | null;
  partner: UserRow | null;
  /** True only until the first couple data exists (cached or fetched). */
  loading: boolean;
  goals: GoalWithCompletions[];
  goalsLoading: boolean;
  refetch: () => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const coupleQ = useQuery({
    queryKey: qk.couple(userId ?? ""),
    queryFn: () => fetchCouple(userId!),
    enabled: !!userId,
  });
  const couple = coupleQ.data?.couple ?? null;
  const coupleId = couple?.id;
  const partner = coupleQ.data?.partner ?? null;

  const goalsQ = useQuery({
    queryKey: qk.goals(coupleId ?? ""),
    queryFn: () => fetchGoals(coupleId!),
    enabled: !!coupleId,
  });

  // Warm the other tabs so switching to them never shows a loading state.
  useEffect(() => {
    if (!coupleId) return;
    queryClient.prefetchQuery({ queryKey: qk.dreams(coupleId), queryFn: () => fetchDreams(coupleId) });
    queryClient.prefetchInfiniteQuery({
      queryKey: qk.journal(coupleId),
      queryFn: ({ pageParam }) => fetchJournalPage(coupleId, pageParam),
      initialPageParam: null as string | null,
    });
  }, [coupleId, queryClient]);

  useRealtimeSync(coupleId, userId, partner?.id);

  const loading = authLoading || (!!userId && coupleQ.isPending);
  const value: AppData = {
    user,
    couple,
    self: coupleQ.data?.self ?? null,
    partner,
    loading,
    goals: goalsQ.data ?? [],
    goalsLoading: coupleId ? goalsQ.isPending : loading,
    refetch: async () => {
      await queryClient.refetchQueries({ type: "active" });
    },
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

// ── Realtime ─────────────────────────────────────────────────────────────
// One channel per couple. Check-ins patch the goals cache directly (no
// refetch); everything else invalidates the affected queries.

function applyCompletionChange(
  goals: GoalWithCompletions[],
  payload: RealtimePostgresChangesPayload<CompletionLite>
): GoalWithCompletions[] {
  if (payload.eventType === "DELETE") {
    const id = payload.old.id;
    if (!id) return goals;
    return goals.map((g) =>
      g.completions.some((c) => c.id === id)
        ? { ...g, completions: g.completions.filter((c) => c.id !== id) }
        : g
    );
  }
  const row = payload.new;
  const lite: CompletionLite = { id: row.id, goal_id: row.goal_id, user_id: row.user_id, completed_at: row.completed_at };
  return goals.map((g) => {
    if (g.id !== row.goal_id) return g;
    const rest = g.completions.filter((c) => c.id !== row.id);
    const completions = [...rest, lite].sort((a, b) => a.completed_at.localeCompare(b.completed_at));
    return { ...g, completions };
  });
}

function useRealtimeSync(coupleId: string | undefined, userId: string | undefined, partnerId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!coupleId || !userId) return;
    const supabase = createClient();
    const goalsKey = qk.goals(coupleId);
    const invalidateMemories = () => {
      queryClient.invalidateQueries({ queryKey: ["goal-history"] });
      queryClient.invalidateQueries({ queryKey: qk.journal(coupleId) });
    };

    let channel = supabase
      .channel(`couple-${coupleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals", filter: `couple_id=eq.${coupleId}` },
        () => queryClient.invalidateQueries({ queryKey: goalsKey })
      )
      // Completions carry no couple_id; RLS limits delivery to our couple.
      .on<CompletionLite>(
        "postgres_changes",
        { event: "*", schema: "public", table: "completions" },
        (payload) => {
          queryClient.setQueryData<GoalWithCompletions[]>(goalsKey, (prev) =>
            prev ? applyCompletionChange(prev, payload) : prev
          );
          invalidateMemories();
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "completion_media" }, invalidateMemories)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dreams", filter: `couple_id=eq.${coupleId}` },
        () => queryClient.invalidateQueries({ queryKey: qk.dreams(coupleId) })
      )
      // Partner joining / leaving.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "couple_members", filter: `couple_id=eq.${coupleId}` },
        () => queryClient.invalidateQueries({ queryKey: qk.couple(userId) })
      );

    if (partnerId) {
      // Partner renaming themselves.
      channel = channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${partnerId}` },
        () => queryClient.invalidateQueries({ queryKey: qk.couple(userId) })
      );
    }

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [coupleId, userId, partnerId, queryClient]);
}
