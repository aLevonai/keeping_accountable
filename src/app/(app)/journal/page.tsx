"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppData } from "@/contexts/app-data";
import { useDreams } from "@/hooks/use-dreams";
import { useActions } from "@/lib/actions";
import { useJournal } from "@/hooks/use-journal";
import { JournalSkeleton } from "@/components/ui/page-skeleton";
import { confirmSheet } from "@/components/ui/feedback";
import { firstName } from "@/components/ui/bits";
import { Scrapbook, type JournalItem, type People } from "@/components/journal/scrapbook";
import { Lightbox } from "@/components/journal/lightbox";

export default function JournalPage() {
  return (
    <Suspense fallback={<JournalSkeleton />}>
      <Journal />
    </Suspense>
  );
}

function Journal() {
  const params = useSearchParams();
  const openParam = params.get("open");
  const dreamParam = params.get("dream");
  const { user, couple, self, partner, loading } = useAppData();
  const coupleId = couple?.id;
  const { dreams } = useDreams(coupleId);
  const actions = useActions();

  const q = useJournal(coupleId);

  // Deep links (?open=<check-in> from a notification, ?dream=<id>) open or
  // highlight an entry. Re-applied whenever the param changes.
  const [openId, setOpenId] = useState<string | null>(openParam);
  const [lastParam, setLastParam] = useState(openParam);
  if (openParam !== lastParam) {
    setLastParam(openParam);
    setOpenId(openParam);
  }
  const [who, setWho] = useState<"all" | "me" | "partner">("all");
  const highlightRef = useRef<HTMLElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const completions = q.data?.pages.flat() ?? [];
  const oldestLoaded = completions[completions.length - 1]?.completed_at;
  const allItems: JournalItem[] = [
    ...completions.map((c) => ({ kind: "checkin" as const, id: c.id, date: c.completed_at, c })),
    ...dreams
      // Only interleave dreams within the loaded window, so they don't all
      // pile up at the end before older pages arrive.
      .filter((d) => d.achieved_at && (!q.hasNextPage || !oldestLoaded || d.achieved_at >= oldestLoaded))
      .map((d) => ({ kind: "dream" as const, id: d.id, date: d.achieved_at!, d })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // Person filter. Shared dreams belong to both of you, so they always show.
  const whoId = who === "me" ? user?.id : who === "partner" ? partner?.id : undefined;
  const items = whoId
    ? allItems.filter((i) =>
        i.kind === "checkin" ? i.c.user_id === whoId : i.d.owner_id === null || i.d.owner_id === whoId
      )
    : allItems;

  // Infinite scroll.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !isFetchingNextPage) void fetchNextPage(); },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const hasItems = allItems.length > 0;
  useEffect(() => {
    if (dreamParam && hasItems) highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [dreamParam, hasItems]);

  if (loading || !user || (q.isPending && !!coupleId)) return <JournalSkeleton />;

  const people: People = {
    selfId: user.id,
    selfName: firstName(self?.display_name, "You"),
    partnerName: firstName(partner?.display_name, "Partner"),
  };
  const openIndex = openId ? items.findIndex((i) => i.id === openId) : -1;

  async function handleDelete(item: JournalItem) {
    if (item.kind !== "checkin") return;
    const ok = await confirmSheet({
      title: "Delete this check-in?",
      message: item.c.completion_media?.length ? "Its photo will be deleted too." : undefined,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const next = items[openIndex + 1] ?? items[openIndex - 1];
    setOpenId(next && next.id !== item.id ? next.id : null);
    await actions.deleteCheckIn(item.c);
  }

  async function handleRemovePhoto(item: JournalItem) {
    if (item.kind !== "checkin" || !item.c.completion_media?.[0]) return;
    const ok = await confirmSheet({ title: "Remove this photo?", confirmLabel: "Remove", destructive: true });
    if (ok) await actions.removePhoto(item.c.id, item.c.goal_id, item.c.completion_media[0]);
  }

  return (
    <div className="paper-bg min-h-screen pb-40 -mb-24">
      <div className="px-5 pt-14 pb-2">
        <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[30px] text-foreground leading-none">Journal</h1>
        {hasItems && (
          <p className="font-hand text-[19px] text-muted mt-1.5">
            {people.selfName} & {people.partnerName} — our story so far
          </p>
        )}
        {hasItems && partner && (
          <div className="flex gap-1.5 mt-3" role="tablist" aria-label="Show entries from">
            {([
              ["all", "Both of us"],
              ["me", people.selfName],
              ["partner", people.partnerName],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={who === key}
                onClick={() => setWho(key)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                  who === key ? "bg-foreground text-background border-foreground" : "bg-surface/70 text-muted border-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasItems ? (
        <div className="flex justify-center pt-16 px-10">
          <div className="relative bg-[#FFF1B8] px-6 py-7 -rotate-2 shadow-[0_14px_18px_-14px_rgba(60,40,20,0.45)] max-w-[260px]">
            <span className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary" />
            <p className="font-hand text-[24px] leading-tight text-[#3B332C] text-center">
              Your story starts with your first check-in.
            </p>
            <p className="font-hand text-[17px] text-[#8A7B6E] text-center mt-2">Add a photo — it ends up here.</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="font-hand text-[22px] text-muted text-center pt-16 px-10">
          Nothing from {who === "me" ? people.selfName : people.partnerName} in these pages yet.
        </p>
      ) : (
        <Scrapbook
          items={items}
          people={people}
          onOpen={setOpenId}
          highlightId={dreamParam}
          highlightRef={highlightRef}
        />
      )}

      <div ref={sentinel} className="h-10" />
      {isFetchingNextPage && (
        <p className="font-hand text-[18px] text-muted text-center">turning the page…</p>
      )}
      {hasItems && !hasNextPage && (
        <p className="font-hand text-[18px] text-muted text-center mt-6">~ the beginning ~</p>
      )}

      {openIndex >= 0 && (
        <Lightbox
          items={items}
          index={openIndex}
          people={people}
          onIndex={(i) => setOpenId(items[i]?.id ?? null)}
          onClose={() => setOpenId(null)}
          onDelete={handleDelete}
          onRemovePhoto={handleRemovePhoto}
        />
      )}
    </div>
  );
}
