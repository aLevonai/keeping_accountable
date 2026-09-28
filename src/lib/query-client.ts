import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const CACHE_STORAGE_KEY = "checkmate-query-cache";
// Bump when a persisted query's shape changes so old caches are discarded.
export const CACHE_BUSTER = "v1";
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 14; // 14 days

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cached data renders instantly; anything older than this refetches
        // in the background on mount / app resume.
        staleTime: 30 * 1000,
        // Must be ≥ the persister maxAge or restored queries get collected.
        gcTime: CACHE_MAX_AGE,
        refetchOnWindowFocus: true,
        retry: 2,
      },
      mutations: { retry: 0 },
    },
  });
}

// Persists the query cache to localStorage so a cold app launch renders the
// last-known goals, dreams and journal instantly, then refreshes in the
// background. Without storage (server render) this is a no-op persister.
export function makePersister() {
  return createSyncStoragePersister({
    storage: typeof window === "undefined" ? undefined : window.localStorage,
    key: CACHE_STORAGE_KEY,
    // Writing the cache is a synchronous JSON.stringify + localStorage write on
    // the main thread; batch bursts (tab switch refetches, realtime) into one.
    throttleTime: 3000,
  });
}

export function clearPersistedCache() {
  try {
    window.localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
