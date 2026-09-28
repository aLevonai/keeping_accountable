"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/contexts/app-data";
import { qk, fetchGoal, fetchGoalHistory } from "@/lib/queries";

// A single goal: served from the goals list cache when possible (instant),
// fetched directly otherwise (archived goals, deep links before the list loads).
export function useGoal(goalId: string) {
  const { goals, goalsLoading } = useAppData();
  const cached = goals.find((g) => g.id === goalId);
  const q = useQuery({
    queryKey: qk.goal(goalId),
    queryFn: () => fetchGoal(goalId),
    enabled: !!goalId && !cached && !goalsLoading,
  });
  const goal = cached ?? q.data ?? null;
  return {
    goal,
    loading: !goal && (goalsLoading || q.isPending),
    notFound: !cached && q.isSuccess && !q.data,
  };
}

export function useGoalHistory(goalId: string) {
  return useQuery({
    queryKey: qk.goalHistory(goalId),
    queryFn: () => fetchGoalHistory(goalId),
    enabled: !!goalId,
  });
}

export function usePrefetchGoalHistory() {
  const qc = useQueryClient();
  return (goalId: string) =>
    qc.prefetchQuery({ queryKey: qk.goalHistory(goalId), queryFn: () => fetchGoalHistory(goalId) });
}
