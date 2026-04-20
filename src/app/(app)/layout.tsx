import { BottomNav } from "@/components/ui/bottom-nav";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#fffaf7]">
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
