"use client";

import { useRouter } from "next/navigation";
import { useActions } from "@/lib/actions";
import { DreamForm } from "@/components/dream-form";
import { BackButton } from "@/components/ui/bits";

export default function NewDreamPage() {
  const router = useRouter();
  const { createDream } = useActions();

  return (
    <div className="px-5 pt-14 pb-8 min-h-screen bg-background">
      <BackButton fallback="/dreams" />
      <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-foreground mb-6">New Dream</h1>
      <DreamForm
        initial={{ title: "", note: "", shared: true }}
        submitLabel="Add dream"
        onSubmit={(v) => {
          createDream(v);
          router.replace("/dreams");
        }}
      />
    </div>
  );
}
