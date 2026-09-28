import { BottomNav } from "@/components/ui/bottom-nav";
import { AppDataProvider } from "@/contexts/app-data";
import { AppShell } from "@/components/app-shell";

// Pages here are client components fed by the (persisted) query cache, so the
// routes are static and fully prefetchable — tab switches never wait on the
// server.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <div className="flex flex-col min-h-screen paper-bg">
        <main className="flex-1 pb-24">
          <AppShell>{children}</AppShell>
        </main>
        <BottomNav />
      </div>
    </AppDataProvider>
  );
}
