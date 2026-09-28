"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useAppData } from "@/contexts/app-data";
import { useDreams } from "@/hooks/use-dreams";
import { useJournal } from "@/hooks/use-journal";
import { usePrefetchGoalHistory } from "@/hooks/use-goal";
import { getPeriodRange, getPeriodLabel } from "@/utils/period";
import { goalProgress } from "@/utils/goal-progress";
import { seeded, between } from "@/utils/seeded";
import type { DreamRow, GoalWithCompletions, JournalCompletion, UserRow } from "@/types/database";
import { HomeSkeleton } from "@/components/ui/page-skeleton";
import { AppLogo } from "@/components/ui/logo";
import { Avatar, firstName } from "@/components/ui/bits";
import { Photo } from "@/components/ui/photo";
import { Tape, Tapes } from "@/components/ui/paper";
import { CheckInButton } from "@/components/check-in-button";
import { Tally, HandCheckbox, tornBottom, Squiggle } from "@/components/home/paper-bits";

// Home is the front page of the couple's scrapbook: a torn-paper scorecard for
// the week, the goal list on a notebook page, the latest memory pinned next to
// a sticky note of the partner's week, and dreams as luggage tags.

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

function countThisWeek(goals: GoalWithCompletions[], userId: string): number {
  const range = getPeriodRange("weekly")!;
  let n = 0;
  for (const g of goals) {
    for (const c of g.completions) {
      if (c.user_id !== userId) continue;
      const d = new Date(c.completed_at);
      if (d >= range.start && d <= range.end) n++;
    }
  }
  return n;
}

// ── This week ─────────────────────────────────────────────────────────────

function WeekPerson({ label, name, who, count, color }: {
  label: string;
  name: string | undefined;
  who: "self" | "partner";
  count: number;
  color: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <Avatar name={name} who={who} size={18} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E6053] truncate">{label}</span>
      </div>
      <p className="font-hand text-[44px] leading-none mt-1" style={{ color }}>{count}</p>
      <div className="mt-1.5 min-h-[24px]">
        <Tally count={count} color={color} />
      </div>
    </div>
  );
}

function WeekCard({ mine, theirs, selfName, partner, allDone, hasGoals }: {
  mine: number;
  theirs: number;
  selfName: string | undefined;
  partner: UserRow | null;
  allDone: boolean;
  hasGoals: boolean;
}) {
  const range = getPeriodRange("weekly")!;
  const total = mine + theirs;
  const line = !hasGoals
    ? "Add a goal and start the tally."
    : allDone
      ? "Your list is all done this week. Well played."
      : total === 0
        ? "A fresh week. Make the first mark."
        : partner
          ? `${total} check-in${total === 1 ? "" : "s"} between you so far.`
          : `${total} check-in${total === 1 ? "" : "s"} so far.`;

  return (
    <section className="relative mx-5 mt-5">
      {/* drop-shadow (not box-shadow) so the shadow follows the torn edge */}
      <div style={{ filter: "drop-shadow(0 2px 3px rgba(60,40,20,0.12)) drop-shadow(0 10px 14px rgba(60,40,20,0.08))" }}>
        <div
          className="bg-[#FFFEFB] px-5 pt-6 pb-9"
          style={{ transform: "rotate(-0.8deg)", clipPath: tornBottom("week-card") }}
        >
          <div className="flex items-end justify-between">
            <div className="relative">
              <h2 className="font-hand text-[30px] leading-none text-[#3B332C]">this week</h2>
              <Squiggle className="absolute -bottom-2 left-0 w-full h-2" />
            </div>
            <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-1">
              {format(range.start, "MMM d")} – {format(range.end, "MMM d")}
            </span>
          </div>

          <div className={`grid ${partner ? "grid-cols-2" : "grid-cols-1"} gap-5 mt-5`}>
            <WeekPerson label="You" name={selfName} who="self" count={mine} color="var(--primary)" />
            {partner && (
              <WeekPerson
                label={firstName(partner.display_name, "Partner")}
                name={partner.display_name}
                who="partner"
                count={theirs}
                color="var(--partner-accent)"
              />
            )}
          </div>

          <p className="font-hand text-[20px] leading-tight text-[#6E6053] mt-4">{line}</p>
        </div>
      </div>
      <Tape r={seeded("week-tape")} style={{ top: -9, left: "50%", transform: "translateX(-50%) rotate(-3deg)", width: 76 }} />
    </section>
  );
}

// ── Goals notebook ────────────────────────────────────────────────────────

function GoalLine({ goal, userId, partnerId }: { goal: GoalWithCompletions; userId: string; partnerId?: string }) {
  const p = goalProgress(goal, userId, partnerId);
  const prefetchHistory = usePrefetchGoalHistory();
  const sub =
    goal.cadence === "once"
      ? p.myDone ? "done" : "one-time"
      : `${p.myCount} of ${p.target} ${getPeriodLabel(goal.cadence)}`;
  const tag = p.mode === "joint" ? " · together" : p.mode === "separate" ? " · each of us" : "";

  return (
    <div className="relative flex items-center min-h-[58px] border-t border-[rgba(120,160,200,0.32)]">
      <div className="w-[48px] flex-shrink-0 flex justify-center">
        <HandCheckbox checked={p.myDone} />
      </div>
      <Link
        href={`/goals/${goal.id}`}
        onPointerDown={() => prefetchHistory(goal.id)}
        className="flex-1 min-w-0 pl-3 py-2 active:opacity-60 transition-opacity"
      >
        <p
          className={`text-[15px] font-medium truncate ${p.myDone ? "text-muted line-through decoration-2 decoration-[rgba(196,112,79,0.55)]" : "text-foreground"}`}
          dir="auto"
        >
          {goal.title}
        </p>
        <p className="font-hand text-[17px] leading-tight text-[#8A7B6E]">{sub}{tag}</p>
      </Link>
      <div className="pr-3 pl-2 flex-shrink-0">
        <CheckInButton goal={goal} subdued={p.myDone} size={30} />
      </div>
    </div>
  );
}

function GoalsNotebook({ goals, userId, partnerId }: { goals: GoalWithCompletions[]; userId: string; partnerId?: string }) {
  const doneCount = goals.filter((g) => goalProgress(g, userId, partnerId).myDone).length;
  return (
    <section className="relative mx-4 mt-9">
      <div
        className="relative bg-[#FFFDF8] pt-4 pb-1 shadow-[0_2px_5px_rgba(60,40,20,0.1),0_14px_24px_-16px_rgba(60,40,20,0.35)]"
        style={{ transform: "rotate(0.5deg)" }}
      >
        {/* Notebook margin */}
        <div aria-hidden className="absolute top-0 bottom-0 left-[48px] w-px bg-[rgba(214,120,120,0.5)]" />
        <div className="flex items-end justify-between pl-[60px] pr-4 pb-2.5">
          <h2 className="font-hand text-[28px] leading-none text-[#3B332C]">our list</h2>
          <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-1">
            {doneCount}/{goals.length} done
          </span>
        </div>
        {goals.map((g) => (
          <GoalLine key={g.id} goal={g} userId={userId} partnerId={partnerId} />
        ))}
      </div>
      <Tape r={seeded("list-tape")} style={{ top: -8, left: -10, transform: "rotate(-32deg)", width: 58 }} />
    </section>
  );
}

// ── Collage: latest memory + partner's week ───────────────────────────────

function LatestMemory({ c, author }: { c: JournalCompletion; author: string }) {
  const media = c.completion_media[0];
  const r = seeded(c.id + ":home");
  const aspect =
    media.width && media.height ? Math.min(Math.max(media.width / media.height, 0.75), 1.33) : 1;
  return (
    <Link
      href={`/journal?open=${c.id}`}
      className="relative block bg-[#FFFEFB] p-[7px] pb-2.5 shadow-[0_2px_6px_rgba(60,40,20,0.16),0_12px_22px_-12px_rgba(60,40,20,0.35)] active:scale-[0.98] transition-transform"
      style={{ transform: `rotate(${between(r, -4, -1.5)}deg)` }}
    >
      <Tapes r={r} />
      <div className="overflow-hidden bg-[#EDE6DD]" style={{ aspectRatio: String(aspect) }}>
        <Photo path={media.storage_path} thumb className="w-full h-full object-cover" />
      </div>
      <p className="font-hand text-[18px] leading-[1.1] text-[#3B332C] mt-2 px-0.5 line-clamp-2" dir="auto">
        {c.goals?.title ?? "Check-in"}
      </p>
      <p className="font-hand text-[15px] leading-none text-[#8A7B6E] mt-0.5 px-0.5">
        {author} · {format(new Date(c.completed_at), "EEE")}
      </p>
    </Link>
  );
}

function PartnerNote({ partner, goals, userId }: { partner: UserRow; goals: GoalWithCompletions[]; userId: string }) {
  return (
    <div
      className="relative px-3.5 pt-6 pb-4"
      style={{
        background: "linear-gradient(180deg, #DCE8F2 0%, #DCE8F2 84%, #CEDCE8 100%)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08), 0 14px 18px -14px rgba(40,60,80,0.45)",
        borderBottomRightRadius: "18px 6px",
        transform: "rotate(2.2deg)",
      }}
    >
      <span aria-hidden className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-partner-accent shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
      <p className="font-hand text-[22px] leading-none text-[#2F4A5E]">{firstName(partner.display_name, "Partner")}&apos;s week</p>
      <ul className="mt-2.5 flex flex-col gap-2">
        {goals.map((g) => {
          const p = goalProgress(g, userId, partner.id);
          return (
            <li key={g.id}>
              <Link href={`/goals/${g.id}`} className="flex items-baseline gap-2 active:opacity-60">
                <span className="text-[13px] text-[#2B3A46] flex-1 min-w-0 truncate" dir="auto">{g.title}</span>
                <span className="font-hand text-[18px] leading-none text-partner-accent flex-shrink-0">
                  {p.done ? "✓" : `${p.partnerCount}/${p.target}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Dreams as luggage tags ────────────────────────────────────────────────

function DreamTag({ dream, label }: { dream: DreamRow; label: string }) {
  const r = seeded(dream.id + ":tag");
  return (
    <Link
      href="/dreams"
      className="relative flex-shrink-0 w-[146px] pt-5 active:scale-[0.97] transition-transform"
      style={{ transform: `rotate(${between(r, -4, 4)}deg)`, transformOrigin: "50% 0" }}
    >
      {/* String */}
      <svg aria-hidden width="40" height="28" viewBox="0 0 40 28" className="absolute top-0 left-1/2 -translate-x-1/2" fill="none">
        <path d={`M20 26 C ${between(r, 8, 14)} 16, ${between(r, 26, 32)} 10, 20 0`} stroke="#A68A6B" strokeWidth="1.3" />
      </svg>
      <div
        className="relative kraft-paper px-3.5 pt-7 pb-3.5 min-h-[104px] shadow-[0_2px_4px_rgba(60,40,20,0.15)]"
        style={{ clipPath: "polygon(20% 0, 80% 0, 100% 16%, 100% 100%, 0 100%, 0 16%)" }}
      >
        <span aria-hidden className="absolute top-2.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#F6F0E7] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]" />
        <p className="font-mono text-[8px] tracking-[0.2em] uppercase text-[#8A735E]">{label}</p>
        <p className="font-[family-name:var(--font-instrument-serif)] italic text-[19px] leading-[1.1] text-[#2B221B] mt-1 line-clamp-3" dir="auto">
          {dream.title}
        </p>
      </div>
    </Link>
  );
}

function DreamTags({ dreams, userId, partnerName }: { dreams: DreamRow[]; userId: string; partnerName: string }) {
  const label = (d: DreamRow) => (d.owner_id === null ? "together" : d.owner_id === userId ? "yours" : `${partnerName}'s`);
  return (
    <section className="mt-11">
      <div className="px-6 flex items-end justify-between">
        <h2 className="font-hand text-[28px] leading-none text-[#3B332C]">someday…</h2>
        <Link href="/dreams" className="font-hand text-[18px] leading-none text-primary">all dreams →</Link>
      </div>
      <div data-no-swipe className="flex gap-4 overflow-x-auto scrollbar-hide px-5 pt-3 pb-5">
        {dreams.map((d) => (
          <DreamTag key={d.id} dream={d} label={label(d)} />
        ))}
        <Link
          href="/dreams/new"
          className="flex-shrink-0 w-[120px] mt-5 min-h-[104px] border-[1.5px] border-dashed border-[#C9B79F] flex items-center justify-center text-center px-3 active:scale-[0.97] transition-transform"
          style={{ clipPath: "polygon(20% 0, 80% 0, 100% 16%, 100% 100%, 0 100%, 0 16%)" }}
        >
          <span className="font-hand text-[19px] leading-tight text-[#8A735E]">+ add a dream</span>
        </Link>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, couple, partner, self, loading, goalsLoading, goals } = useAppData();
  const { dreams } = useDreams(couple?.id);
  const journal = useJournal(couple?.id);

  if (loading || goalsLoading || !user) return <HomeSkeleton />;

  if (!couple) {
    return (
      <div className="paper-bg flex flex-col items-center justify-center min-h-screen -mb-24 px-6 gap-3 text-center">
        <p className="font-hand text-[26px] text-foreground">You&apos;re not paired yet</p>
        <Link href="/onboard" className="text-sm font-medium text-primary">Start or join a couple →</Link>
      </div>
    );
  }

  const now = new Date();
  const myGoals = goals.filter((g) => g.owner_id === user.id || g.owner_id === null);
  const isDone = (g: GoalWithCompletions) => goalProgress(g, user.id, partner?.id).myDone;
  const list = [...myGoals.filter((g) => !isDone(g)), ...myGoals.filter(isDone)];
  const partnerGoals = partner ? goals.filter((g) => g.owner_id === partner.id) : [];
  const activeDreams = dreams
    .filter((d) => d.achieved_at === null)
    .sort((a, b) => Number(b.owner_id === null) - Number(a.owner_id === null));
  const latest = journal.data?.pages[0]?.find((c) => c.completion_media?.length > 0);
  const authorOf = (c: JournalCompletion) =>
    c.user_id === user.id ? firstName(self?.display_name, "You") : firstName(partner?.display_name, "Partner");
  const showPartnerNote = !!partner && partnerGoals.length > 0;

  return (
    <div className="paper-bg min-h-screen pb-40 -mb-24">
      <header className="px-5 pt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-hand text-[21px] leading-none text-muted">{format(now, "EEEE, MMMM d")}</p>
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[31px] leading-[1.05] text-foreground mt-1.5">
            {greeting(now)}, {firstName(self?.display_name, "you")}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <Link
            href="/goals/new"
            aria-label="New goal"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white shadow-[0_3px_8px_rgba(196,112,79,0.35)] active:scale-95 transition-transform"
          >
            <Plus size={19} />
          </Link>
          <AppLogo size={34} />
        </div>
      </header>

      {!partner && (
        <Link
          href="/profile"
          className="relative block mx-10 mt-6 bg-[#FFF1B8] px-5 pt-6 pb-4 -rotate-1 shadow-[0_14px_18px_-14px_rgba(60,40,20,0.45)] active:scale-[0.99] transition-transform"
        >
          <span aria-hidden className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary" />
          <p className="font-hand text-[23px] leading-tight text-[#3B332C]">Waiting for your partner…</p>
          <p className="font-hand text-[18px] text-primary mt-1">send them the invite →</p>
        </Link>
      )}

      <WeekCard
        mine={countThisWeek(goals, user.id)}
        theirs={partner ? countThisWeek(goals, partner.id) : 0}
        selfName={self?.display_name}
        partner={partner}
        allDone={list.length > 0 && list.every(isDone)}
        hasGoals={list.length > 0}
      />

      {list.length > 0 ? (
        <GoalsNotebook goals={list} userId={user.id} partnerId={partner?.id} />
      ) : (
        <div className="flex justify-center mt-10">
          <Link
            href="/goals/new"
            className="relative bg-[#FFF1B8] px-6 pt-7 pb-5 rotate-2 shadow-[0_14px_18px_-14px_rgba(60,40,20,0.45)] max-w-[240px] text-center"
          >
            <span aria-hidden className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary" />
            <p className="font-hand text-[24px] leading-tight text-[#3B332C]">Nothing on the list yet.</p>
            <p className="font-hand text-[19px] text-primary mt-1">add your first goal →</p>
          </Link>
        </div>
      )}

      {(latest || showPartnerNote) && (
        <div className={`flex items-start gap-4 px-5 mt-10 ${latest && showPartnerNote ? "" : "justify-center"}`}>
          {latest && (
            <div className={showPartnerNote ? "w-[54%]" : "w-[62%]"}>
              <LatestMemory c={latest} author={authorOf(latest)} />
              <Link href="/journal" className="block font-hand text-[17px] text-muted mt-3 ml-1">from the journal →</Link>
            </div>
          )}
          {showPartnerNote && (
            <div className={latest ? "flex-1 min-w-0 mt-3" : "w-[70%]"}>
              <PartnerNote partner={partner!} goals={partnerGoals} userId={user.id} />
            </div>
          )}
        </div>
      )}

      {activeDreams.length > 0 && (
        <DreamTags dreams={activeDreams} userId={user.id} partnerName={firstName(partner?.display_name, "Partner")} />
      )}
    </div>
  );
}
