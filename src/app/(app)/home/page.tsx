"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import { countCompletionsInPeriod, getPeriodRange } from "@/utils/period";
import type { GoalWithCompletions } from "@/hooks/use-goals";
import { HomeSkeleton } from "@/components/ui/page-skeleton";
import { Check } from "lucide-react";
import { AppLogo } from "@/components/ui/logo";

const CADENCE_META: Record<string, { color: string; dot: string; label: string }> = {
  weekly:  { color: "#3D7060", dot: "#4A9078", label: "Weekly" },
  monthly: { color: "#5A4A8A", dot: "#7B62C8", label: "Monthly" },
  yearly:  { color: "#B87333", dot: "#E8923A", label: "Yearly" },
  once:    { color: "#9C8B7E", dot: "#9C8B7E", label: "One-time" },
};
const CADENCE_ORDER = ["weekly", "monthly", "yearly", "once"];

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function CadenceHeader({ cadence }: { cadence: string }) {
  const m = CADENCE_META[cadence] ?? CADENCE_META.once;
  return (
    <div className="flex items-center gap-2 mt-5 mb-2.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.dot }} />
      <span className="text-[11px] font-bold tracking-[0.09em] uppercase" style={{ color: m.color }}>{m.label}</span>
      <div className="flex-1 h-px" style={{ background: m.color + "22" }} />
    </div>
  );
}

function MiniAvatar({ initial, variant }: { initial: string; variant: "self" | "partner" }) {
  const bg = variant === "partner" ? "var(--partner-light)" : "var(--primary-light)";
  const fg = variant === "partner" ? "var(--partner-accent)" : "var(--primary)";
  const borderColor = variant === "partner" ? "rgba(74,122,155,0.4)" : "rgba(196,112,79,0.4)";
  return (
    <div
      className="w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0"
      style={{ background: bg, color: fg, border: `1.5px solid ${borderColor}` }}
    >
      {initial}
    </div>
  );
}

function Avatar({ initial, variant, size = 28 }: { initial: string; variant: "self" | "partner"; size?: number }) {
  const bg = variant === "partner" ? "var(--partner-light)" : "var(--primary-light)";
  const fg = variant === "partner" ? "var(--partner-accent)" : "var(--primary)";
  const borderColor = variant === "partner" ? "rgba(74,122,155,0.4)" : "rgba(196,112,79,0.4)";
  const fontSize = Math.round(size * 0.38);
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
      style={{ width: size, height: size, background: bg, color: fg, border: `1.5px solid ${borderColor}`, fontSize }}
    >
      {initial}
    </div>
  );
}

function ProgressBar({ count, target, color, height = "h-[3px]" }: {
  count: number; target: number; color: string; height?: string;
}) {
  const pct = target > 0 ? Math.min(count / target, 1) * 100 : 0;
  return (
    <div className={`flex-1 ${height} rounded-full bg-[--border] overflow-hidden`}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function DualProgressBars({ goal, myUserId, selfInitial, partnerInitial, partnerId }: {
  goal: GoalWithCompletions; myUserId: string; selfInitial: string; partnerInitial: string; partnerId: string;
}) {
  const myCompletions = goal.completions.filter(c => c.user_id === myUserId);
  const partnerCompletions = goal.completions.filter(c => c.user_id === partnerId);
  const myCount = countCompletionsInPeriod(myCompletions, goal.cadence);
  const partnerCount = countCompletionsInPeriod(partnerCompletions, goal.cadence);
  const target = goal.cadence_target;
  const myDone = myCount >= target;
  const partnerDone = partnerCount >= target;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <MiniAvatar initial={selfInitial} variant="self" />
        <ProgressBar count={myCount} target={target} color={myDone ? "var(--success)" : "var(--primary)"} height="h-[4px]" />
        <span className="text-[10px] w-[22px] text-right font-medium" style={{ color: myDone ? "var(--success)" : "var(--muted)" }}>{myCount}/{target}</span>
      </div>
      <div className="flex items-center gap-2">
        <MiniAvatar initial={partnerInitial} variant="partner" />
        <ProgressBar count={partnerCount} target={target} color={partnerDone ? "var(--success)" : "var(--partner-accent)"} height="h-[4px]" />
        <span className="text-[10px] w-[22px] text-right font-medium" style={{ color: partnerDone ? "var(--success)" : "var(--muted)" }}>{partnerCount}/{target}</span>
      </div>
    </div>
  );
}

function SharedGoalRow({ goal, myUserId, selfInitial, partnerInitial, partnerId }: {
  goal: GoalWithCompletions; myUserId: string; selfInitial: string; partnerInitial: string; partnerId: string;
}) {
  const target = goal.cadence_target;

  if (goal.is_joint) {
    const totalCount = countCompletionsInPeriod(goal.completions, goal.cadence);
    const done = totalCount >= target;
    return (
      <div className="py-2.5 border-b border-[--border] last:border-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[14px] font-medium text-[--foreground]">{goal.title}</span>
          {done ? (
            <div className="w-[26px] h-[26px] flex items-center justify-center">
              <Check size={13} className="text-[--success]" />
            </div>
          ) : (
            <Link href={`/check-in/${goal.id}`} className="w-[26px] h-[26px] flex items-center justify-center border border-[--border] rounded-full text-[--muted] text-base leading-none active:scale-95 transition-transform">+</Link>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <ProgressBar count={totalCount} target={target} color={done ? "var(--success)" : "var(--primary)"} height="h-[4px]" />
          <span className="text-[10px] text-[--muted] w-[22px] text-right">{totalCount}/{target}</span>
        </div>
      </div>
    );
  }

  const myCompletions = goal.completions.filter(c => c.user_id === myUserId);
  const myCount = countCompletionsInPeriod(myCompletions, goal.cadence);
  const myDone = myCount >= target;

  return (
    <div className="py-2.5 border-b border-[--border] last:border-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[14px] font-medium text-[--foreground]">{goal.title}</span>
        {myDone ? (
          <div className="w-[26px] h-[26px] flex items-center justify-center">
            <Check size={13} className="text-[--success]" />
          </div>
        ) : (
          <Link href={`/check-in/${goal.id}`} className="w-[26px] h-[26px] flex items-center justify-center border border-[--border] rounded-full text-[--muted] text-base leading-none active:scale-95 transition-transform">+</Link>
        )}
      </div>
      <DualProgressBars goal={goal} myUserId={myUserId} selfInitial={selfInitial} partnerInitial={partnerInitial} partnerId={partnerId} />
    </div>
  );
}

function MyGoalRow({ goal, userId }: { goal: GoalWithCompletions; userId: string }) {
  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const done = goal.cadence === "once" ? count >= 1 : count >= target;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[--border] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          {done && <Check size={13} className="text-[--success] flex-shrink-0" />}
          <span className="text-[14px] font-medium truncate" style={{ color: done ? "var(--muted)" : "var(--foreground)" }}>
            {goal.title}
          </span>
        </div>
        {goal.cadence !== "once" && (
          <div className="flex items-center gap-1.5">
            <ProgressBar count={count} target={target} color={done ? "var(--success)" : "var(--primary)"} height="h-[3px]" />
            <span className="text-[10px] text-[--muted] w-[22px] text-right">{count}/{target}</span>
          </div>
        )}
        {goal.cadence === "once" && (
          <span className="text-[10px] text-[--muted]">{done ? "Done" : "Not done yet"}</span>
        )}
      </div>
      {!done && (
        <Link
          href={`/check-in/${goal.id}`}
          className="w-[30px] h-[30px] flex items-center justify-center border border-[--border] rounded-full text-[--muted] text-lg leading-none flex-shrink-0 active:scale-95 transition-transform"
        >+</Link>
      )}
    </div>
  );
}

function PartnerGoalRow({ goal }: { goal: GoalWithCompletions }) {
  const count = countCompletionsInPeriod(goal.completions, goal.cadence);
  const target = goal.cadence_target;
  const done = goal.cadence === "once" ? count >= 1 : count >= target;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[--border] last:border-0" style={{ opacity: 0.82 }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          {done && <Check size={13} className="text-[--success] flex-shrink-0" />}
          <span className="text-[14px] font-normal text-[--foreground] truncate">{goal.title}</span>
        </div>
        {goal.cadence !== "once" && (
          <div className="flex items-center gap-1.5">
            <ProgressBar count={count} target={target} color={done ? "var(--success)" : "var(--partner-accent)"} height="h-[3px]" />
            <span className="text-[10px] text-[--muted] w-[22px] text-right">{count}/{target}</span>
          </div>
        )}
        {goal.cadence === "once" && (
          <span className="text-[10px] text-[--muted]">{done ? "Done" : "Not done yet"}</span>
        )}
      </div>
    </div>
  );
}

function countWeeklyCheckIns(goals: GoalWithCompletions[], userId: string): number {
  const range = getPeriodRange("weekly");
  if (!range) return 0;
  let total = 0;
  for (const g of goals) {
    const userCompletions = g.completions.filter(c => c.user_id === userId);
    total += userCompletions.filter(c => {
      const d = new Date(c.completed_at);
      return d >= range.start && d <= range.end;
    }).length;
  }
  return total;
}

export default function HomePage() {
  const { user } = useAuth();
  const { couple, partner, self, loading: coupleLoading, goalsLoading, goals } = useAppData();
  const loading = !user || coupleLoading || goalsLoading;

  if (loading) return <HomeSkeleton />;

  if (!couple) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-3 text-center">
        <p className="font-semibold text-[--foreground]">Waiting for your partner</p>
        <p className="text-sm text-[--muted]">Share your invite code from the Profile tab so they can join.</p>
      </div>
    );
  }

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const coupleName = `${self?.display_name ?? "You"} & ${partner?.display_name ?? "Partner"}`;

  const sharedGoals = goals.filter(g => g.owner_id === null);
  const myGoals = goals.filter(g => g.owner_id === user?.id);
  const partnerGoals = goals.filter(g => g.owner_id === partner?.id);

  const myCheckIns = countWeeklyCheckIns(goals, user!.id);
  const partnerCheckIns = partner ? countWeeklyCheckIns(goals, partner.id) : 0;

  const selfInitial = getInitial(self?.display_name ?? "Y");
  const partnerInitial = getInitial(partner?.display_name ?? "P");

  const grouped = CADENCE_ORDER.map(cad => ({
    cadence: cad,
    shared: sharedGoals.filter(g => g.cadence === cad),
    mine: myGoals.filter(g => g.cadence === cad),
    partner: partnerGoals.filter(g => g.cadence === cad),
  })).filter(g => g.shared.length + g.mine.length + g.partner.length > 0);

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[--muted]">{dateLabel}</p>
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground] leading-tight mt-0.5">
            {coupleName}
          </h1>
        </div>
        <AppLogo size={38} />
      </div>

      {/* Partner split card */}
      {partner && (
        <div className="mx-4 mb-2 bg-[--surface] rounded-2xl border border-[--border] overflow-hidden">
          <div className="flex">
            <div className="flex-1 px-4 py-3.5 border-r border-[--border]">
              <div className="flex items-center gap-1.5 mb-2">
                <Avatar initial={selfInitial} variant="self" size={24} />
                <span className="text-[12px] font-semibold text-[--foreground]">You</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[26px] font-light text-[--foreground] leading-none">{myCheckIns}</span>
                <span className="text-[11px] text-[--muted]">check-ins</span>
              </div>
            </div>
            <div className="flex-1 px-4 py-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Avatar initial={partnerInitial} variant="partner" size={24} />
                <span className="text-[12px] font-semibold text-[--foreground]">{partner.display_name.split(" ")[0]}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[26px] font-light text-[--foreground] leading-none">{partnerCheckIns}</span>
                <span className="text-[11px] text-[--muted]">check-ins</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-5">
          <p className="text-[--muted] text-sm">No goals yet.</p>
          <Link href="/goals/new" className="text-sm font-medium text-[--primary]">Add your first goal</Link>
        </div>
      ) : (
        <div className="px-5">
          {grouped.map(group => (
            <div key={group.cadence}>
              <CadenceHeader cadence={group.cadence} />

              {group.shared.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[--muted] mb-1.5">Shared</p>
                  <div>
                    {group.shared.map(g => (
                      <SharedGoalRow
                        key={g.id}
                        goal={g}
                        myUserId={user!.id}
                        selfInitial={selfInitial}
                        partnerInitial={partnerInitial}
                        partnerId={partner?.id ?? ""}
                      />
                    ))}
                  </div>
                </div>
              )}

              {group.mine.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[--muted] mb-1.5">You</p>
                  <div>
                    {group.mine.map(g => (
                      <MyGoalRow key={g.id} goal={g} userId={user!.id} />
                    ))}
                  </div>
                </div>
              )}

              {group.partner.length > 0 && (
                <div className="mb-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1.5"
                    style={{ color: "var(--partner-accent)", opacity: 0.75 }}
                  >
                    {partner?.display_name.split(" ")[0] ?? "Partner"}
                  </p>
                  <div>
                    {group.partner.map(g => (
                      <PartnerGoalRow key={g.id} goal={g} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="px-5 mt-3">
        <Link href="/goals/new" className="text-sm font-medium text-[--primary]">+ New goal</Link>
      </div>
    </div>
  );
}
