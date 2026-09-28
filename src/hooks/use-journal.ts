"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { qk, fetchJournalPage, JOURNAL_PAGE_SIZE } from "@/lib/queries";

// Journal check-ins, newest first, paged by completed_at. Shared by the
// Journal tab and Home's "latest memory" (same cache entry).
export function useJournal(coupleId: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: qk.journal(coupleId ?? ""),
    queryFn: ({ pageParam }) => fetchJournalPage(coupleId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.length === JOURNAL_PAGE_SIZE ? last[last.length - 1].completed_at : undefined),
    enabled: !!coupleId,
  });
}
