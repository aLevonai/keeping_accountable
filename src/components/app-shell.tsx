"use client";

import { useAppData } from "@/contexts/app-data";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

// Pull-to-refresh refetches every query on screen (goals, journal, dreams…).
export function AppShell({ children }: { children: React.ReactNode }) {
  const { refetch } = useAppData();
  return <PullToRefresh onRefresh={refetch}>{children}</PullToRefresh>;
}
