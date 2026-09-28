"use client";

import { useRouter } from "next/navigation";
import { useActions } from "@/lib/actions";
import { GoalForm, DEFAULT_GOAL_VALUES } from "@/components/goal-form";
import { BackButton } from "@/components/ui/bits";

export default function NewGoalPage() {
  const router = useRouter();
  const { createGoal } = useActions();

  return (
    <div className="px-5 pt-14 pb-8 min-h-screen bg-background">
      <BackButton fallback="/goals" />
      <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-foreground mb-6">New Goal</h1>
      <GoalForm
        initial={DEFAULT_GOAL_VALUES}
        submitLabel="Create goal"
        onSubmit={(v) => {
          // Optimistic: the goal is in the list before the insert finishes.
          createGoal(v, v.reminder);
          router.replace("/goals");
        }}
      />
    </div>
  );
}
