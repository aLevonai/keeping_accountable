"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";
import { useGoals } from "@/hooks/use-goals";
import { GoalCard } from "@/components/goal-card";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";

type Filter = "all" | "mine" | "shared" | "partner";

export default function GoalsPage() {
  const { user } = useAuth();
  const { couple, partner } = useCouple(user?.id);
  const { goals, loading } = useGoals(couple?.id);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = goals.filter((g) => {
    if (filter === "mine") return g.owner_id === user?.id;
    if (filter === "shared") return g.owner_id === null;
    if (filter === "partner") return g.owner_id === partner?.id;
    return true;
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "mine", label: "Mine" },
    { key: "shared", label: "Shared" },
    { key: "partner", label: partner?.display_name ?? "Partner" },
  ];

  return (
    <div className="flex flex-col px-4 pt-14 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Goals</h1>
        <Link
          href="/goals/new"
          className="flex items-center justify-center w-10 h-10 rounded-2xl bg-rose-500 text-white shadow-sm active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </Link>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors",
              filter === key
                ? "bg-rose-500 text-white"
                : "bg-white text-stone-500 border border-stone-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="text-3xl animate-bounce">💫</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <div className="text-4xl">🎯</div>
          <p className="text-stone-500 text-sm">No goals here yet.</p>
          <Link href="/goals/new" className="text-rose-500 font-semibold text-sm">
            Add one →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((g) => (
            <GoalCard key={g.id} goal={g} userId={user!.id} isShared={g.owner_id === null} />
          ))}
        </div>
      )}
    </div>
  );
}
