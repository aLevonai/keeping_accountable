"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";
import type { Cadence } from "@/types/database";

const CADENCES: { value: Cadence; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "once", label: "One-time" },
];

export default function NewGoalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { couple } = useCouple(user?.id);
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [target, setTarget] = useState("3");
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!couple || !user) return;
    setLoading(true);

    await supabase.from("goals").insert({
      couple_id: couple.id,
      owner_id: isShared ? null : user.id,
      title: title.trim(),
      emoji: "🎯",
      color: "#374151",
      cadence,
      cadence_target: cadence === "once" ? 1 : parseInt(target) || 1,
      starts_on: new Date().toISOString().split("T")[0],
    });

    router.push("/home");
  }

  return (
    <div className="px-4 pt-12 pb-8 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 underline">← Back</button>
        <h1 className="text-lg font-bold text-gray-900">New Goal</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Title</label>
          <input
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="e.g. Work out 3 times a week"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Frequency</label>
          <div className="flex gap-2 flex-wrap">
            {CADENCES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCadence(value)}
                className={`px-3 py-1.5 rounded border text-sm ${cadence === value ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {cadence !== "once" && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Target (times per {cadence === "weekly" ? "week" : cadence === "monthly" ? "month" : "year"})
            </label>
            <input
              type="number"
              min="1"
              max="365"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-gray-400"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center justify-between border border-gray-200 rounded px-3 py-2">
          <div>
            <p className="text-sm font-medium text-gray-900">Shared goal</p>
            <p className="text-xs text-gray-500">Both of you track this together</p>
          </div>
          <button
            type="button"
            onClick={() => setIsShared(!isShared)}
            className={`w-10 h-5 rounded-full relative transition-colors ${isShared ? "bg-gray-900" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isShared ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        <button
          type="submit"
          disabled={!title.trim() || loading}
          className="mt-2 bg-gray-900 text-white font-medium py-3 rounded text-sm disabled:opacity-40"
        >
          {loading ? "Creating..." : "Create goal"}
        </button>
      </form>
    </div>
  );
}
