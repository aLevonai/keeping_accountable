"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAppData } from "@/contexts/app-data";
import { useGoal } from "@/hooks/use-goal";
import { useActions } from "@/lib/actions";
import { qk, fetchReminder } from "@/lib/queries";
import { GoalForm, DEFAULT_GOAL_VALUES, type GoalFormValues } from "@/components/goal-form";
import { BackButton } from "@/components/ui/bits";

export function EditGoal({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAppData();
  const { goal, loading, notFound } = useGoal(id);
  const { updateGoal } = useActions();
  const reminder = useQuery({
    queryKey: qk.reminder(id, user?.id ?? ""),
    queryFn: () => fetchReminder(id, user!.id),
    enabled: !!user,
  });

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3 px-6 text-center">
        <p className="text-muted text-sm">Goal not found.</p>
        <Link href="/goals" className="text-sm text-primary font-semibold underline">Back to goals</Link>
      </div>
    );
  }

  const ready = !loading && goal && !reminder.isPending;
  const rem = reminder.data;
  const initial: GoalFormValues | null = ready
    ? {
        title: goal.title,
        cadence: goal.cadence,
        cadence_target: goal.cadence_target,
        shared: goal.owner_id === null,
        is_joint: goal.is_joint ?? false,
        reminder: rem?.enabled
          ? { enabled: true, hour: rem.hour, minute: rem.minute === 30 ? 30 : 0, day_of_week: rem.day_of_week ?? 0 }
          : DEFAULT_GOAL_VALUES.reminder,
      }
    : null;

  return (
    <div className="paper-bg px-5 pt-14 pb-40 -mb-24 min-h-screen">
      <BackButton fallback={`/goals/${id}`} />
      <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[32px] leading-none text-foreground mb-7">Edit Goal</h1>
      {initial ? (
        <GoalForm
          initial={initial}
          submitLabel="Save changes"
          onSubmit={async (v) => {
            const ok = await updateGoal(id, v, v.reminder);
            if (ok) router.back();
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="h-12 rounded-xl bg-border/60 animate-pulse" />
          <div className="h-8 w-2/3 rounded-full bg-border/60 animate-pulse" />
          <div className="h-16 rounded-2xl bg-border/60 animate-pulse" />
        </div>
      )}
    </div>
  );
}
