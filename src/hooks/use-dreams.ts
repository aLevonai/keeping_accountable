"use client";

import { useQuery } from "@tanstack/react-query";
import { qk, fetchDreams } from "@/lib/queries";

// Dreams for the couple. Realtime updates arrive via AppDataProvider's channel.
export function useDreams(coupleId: string | null | undefined) {
  const q = useQuery({
    queryKey: qk.dreams(coupleId ?? ""),
    queryFn: () => fetchDreams(coupleId!),
    enabled: !!coupleId,
  });
  return { dreams: q.data ?? [], loading: !!coupleId && q.isPending, refetch: q.refetch };
}
