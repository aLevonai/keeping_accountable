"use client";

import React, { createContext, useContext } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCouple, type CoupleContext } from "@/hooks/use-couple";
import { useGoals } from "@/hooks/use-goals";
import type { GoalWithCompletions } from "@/hooks/use-goals";

interface AppData extends CoupleContext {
  goals: GoalWithCompletions[];
  goalsLoading: boolean;
  refetch: () => void;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const coupleCtx = useCouple(user?.id);
  const { goals, loading: goalsLoading, refetch } = useGoals(coupleCtx.couple?.id);

  return (
    <AppDataContext.Provider value={{ ...coupleCtx, goals, goalsLoading, refetch }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
