"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { qk, fetchSession, type SessionUser } from "@/lib/queries";
import { clearPersistedCache } from "@/lib/query-client";
import { clearPhotoUrlCache } from "@/lib/photo-urls";

// The signed-in user. Read from the local session (persisted in the query
// cache too), so it's available on the first frame of a warm launch.
export function useAuth() {
  const { data: user, isPending } = useQuery({
    queryKey: qk.session,
    queryFn: fetchSession,
    staleTime: Infinity,
  });
  const signOut = useSignOut();
  return { user: user ?? null, loading: isPending, signOut };
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async function signOut() {
    await createClient().auth.signOut();
    queryClient.clear();
    clearPersistedCache();
    clearPhotoUrlCache();
    if (typeof caches !== "undefined") {
      caches.delete("checkmate-photos-v1").catch(() => {});
    }
    router.replace("/welcome");
  };
}

export type { SessionUser };
