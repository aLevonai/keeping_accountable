import { BottomNav } from "@/components/ui/bottom-nav";
import { AppDataProvider } from "@/contexts/app-data";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <div className="flex flex-col min-h-screen bg-[--background]">
        <main className="flex-1 pb-24">
          <AppShell>{children}</AppShell>
        </main>
        <BottomNav />
      </div>
    </AppDataProvider>
  );
}
