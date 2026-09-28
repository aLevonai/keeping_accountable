"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppData } from "@/contexts/app-data";
import { useDreams } from "@/hooks/use-dreams";
import { useActions } from "@/lib/actions";
import { DreamForm } from "@/components/dream-form";
import { BackButton } from "@/components/ui/bits";

export function EditDream({ id }: { id: string }) {
  const router = useRouter();
  const { user, couple } = useAppData();
  const { dreams, loading } = useDreams(couple?.id);
  const { updateDream } = useActions();
  const dream = dreams.find((d) => d.id === id);

  if (!loading && couple && !dream) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3 px-6 text-center">
        <p className="text-muted text-sm">Dream not found.</p>
        <Link href="/dreams" className="text-sm text-primary font-semibold underline">Back to dreams</Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 pb-8 min-h-screen bg-background">
      <BackButton fallback="/dreams" />
      <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-foreground mb-6">Edit Dream</h1>
      {dream ? (
        <DreamForm
          initial={{ title: dream.title, note: dream.note ?? "", shared: dream.owner_id === null }}
          submitLabel="Save changes"
          onSubmit={async (v) => {
            const ok = await updateDream(id, {
              title: v.title.trim(),
              note: v.note.trim() || null,
              owner_id: v.shared ? null : user!.id,
            });
            if (ok) router.back();
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="h-12 rounded-xl bg-border/60 animate-pulse" />
          <div className="h-24 rounded-xl bg-border/60 animate-pulse" />
        </div>
      )}
    </div>
  );
}
