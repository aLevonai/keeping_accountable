"use client";

import { useAppData } from "@/contexts/app-data";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { refetch } = useAppData();
  async function handleRefresh() { refetch(); }
  return <PullToRefresh onRefresh={handleRefresh}>{children}</PullToRefresh>;
}
