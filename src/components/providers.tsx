"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useQueryClient } from "@tanstack/react-query";
import { makeQueryClient, makePersister, CACHE_BUSTER, CACHE_MAX_AGE, clearPersistedCache } from "@/lib/query-client";
import { createClient } from "@/lib/supabase/client";
import { qk, type SessionUser } from "@/lib/queries";
import { FeedbackHost } from "@/components/ui/feedback";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [persister] = useState(makePersister);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === "success",
        },
      }}
    >
      <SessionSync />
      <ServiceWorker />
      {children}
      <FeedbackHost />
    </PersistQueryClientProvider>
  );
}

// Keeps the cached session in step with Supabase auth, and drops every cached
// query if a different account signs in on this device.
function SessionSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      const next: SessionUser | null = session?.user
        ? { id: session.user.id, email: session.user.email ?? null }
        : null;
      const prev = queryClient.getQueryData<SessionUser | null>(qk.session);
      if (prev && next && prev.id !== next.id) {
        queryClient.clear();
        clearPersistedCache();
      }
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        clearPersistedCache();
      }
      if (prev?.id !== next?.id || prev?.email !== next?.email) {
        queryClient.setQueryData(qk.session, next);
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);
  return null;
}

function ServiceWorker() {
  const router = useRouter();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Static-asset caching only in production: /_next/static isn't
    // content-hashed in dev and would serve stale code.
    const url = process.env.NODE_ENV === "production" ? "/sw.js?static=1" : "/sw.js";
    navigator.serviceWorker.register(url).catch((err) => console.error("SW registration failed:", err));

    // Notification taps: the worker focuses the open app and asks it to
    // navigate client-side instead of reloading.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "navigate" && typeof e.data.url === "string" && e.data.url.startsWith("/")) {
        router.push(e.data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);
  return null;
}
