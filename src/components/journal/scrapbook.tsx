"use client";

import { forwardRef } from "react";
import { format } from "date-fns";
import type { DreamRow, JournalCompletion } from "@/types/database";
import { Photo } from "@/components/ui/photo";
import { useIsUploading } from "@/lib/actions";
import { seeded, pick, between } from "@/utils/seeded";

// ── Types ────────────────────────────────────────────────────────────────

export type JournalItem =
  | { kind: "checkin"; id: string; date: string; c: JournalCompletion }
  | { kind: "dream"; id: string; date: string; d: DreamRow };

export interface People {
  selfId?: string;
  selfName: string;
  partnerName: string;
}

export function authorName(item: JournalItem, people: People): string {
  const uid = item.kind === "checkin" ? item.c.user_id : item.d.achieved_by ?? null;
  if (item.kind === "dream" && item.d.owner_id === null && !uid) return "Together";
  return uid && uid === people.selfId ? people.selfName : people.partnerName;
}

// ── Paper props ──────────────────────────────────────────────────────────

const WASHI = [
  { base: "rgba(240,190,150,0.78)", ink: "rgba(255,255,255,0.35)" }, // peach
  { base: "rgba(170,208,188,0.78)", ink: "rgba(255,255,255,0.35)" }, // mint
  { base: "rgba(200,190,228,0.75)", ink: "rgba(255,255,255,0.35)" }, // lavender
  { base: "rgba(244,222,140,0.75)", ink: "rgba(255,255,255,0.4)" },  // butter
  { base: "rgba(170,202,228,0.75)", ink: "rgba(255,255,255,0.35)" }, // sky
  { base: "rgba(236,178,184,0.75)", ink: "rgba(255,255,255,0.35)" }, // rose
] as const;

const PATTERNS = ["plain", "stripes", "dots", "grid"] as const;

function tapeBackground(color: (typeof WASHI)[number], pattern: (typeof PATTERNS)[number]): string {
  switch (pattern) {
    case "stripes":
      return `repeating-linear-gradient(45deg, ${color.ink} 0 3px, transparent 3px 7px), ${color.base}`;
    case "dots":
      return `radial-gradient(${color.ink} 1.2px, transparent 1.4px) 0 0 / 6px 6px, ${color.base}`;
    case "grid":
      return `linear-gradient(${color.ink} 1px, transparent 1px) 0 0 / 5px 5px, linear-gradient(90deg, ${color.ink} 1px, transparent 1px) 0 0 / 5px 5px, ${color.base}`;
    default:
      return color.base;
  }
}

function Tape({ r, style }: { r: () => number; style: React.CSSProperties }) {
  const color = pick(r, WASHI);
  const pattern = pick(r, PATTERNS);
  return (
    <span
      aria-hidden
      className="absolute z-[2] block"
      style={{
        width: 54,
        height: 17,
        background: tapeBackground(color, pattern),
        boxShadow: "0 1px 1.5px rgba(0,0,0,0.08)",
        // Torn ends
        clipPath: "polygon(2% 8%, 8% 0, 16% 10%, 26% 0, 38% 8%, 50% 0, 62% 9%, 74% 0, 86% 8%, 94% 0, 100% 10%, 98% 92%, 90% 100%, 80% 90%, 68% 100%, 56% 92%, 44% 100%, 32% 91%, 20% 100%, 10% 92%, 0 100%)",
        ...style,
      }}
    />
  );
}

function Tapes({ r }: { r: () => number }) {
  const style = Math.floor(r() * 4);
  if (style === 0) {
    return <Tape r={r} style={{ top: -9, left: "50%", transform: `translateX(-50%) rotate(${between(r, -6, 6)}deg)` }} />;
  }
  if (style === 1) {
    return (
      <>
        <Tape r={r} style={{ top: -6, left: -16, transform: "rotate(-38deg)", width: 48 }} />
        <Tape r={r} style={{ top: -6, right: -16, transform: "rotate(38deg)", width: 48 }} />
      </>
    );
  }
  if (style === 2) {
    return <Tape r={r} style={{ top: -8, left: -12, transform: `rotate(${between(r, -40, -28)}deg)`, width: 50 }} />;
  }
  return <Tape r={r} style={{ top: -8, right: -12, transform: `rotate(${between(r, 28, 40)}deg)`, width: 50 }} />;
}

function PaperClip({ color = "#9AA3AB" }: { color?: string }) {
  return (
    <svg aria-hidden width="16" height="38" viewBox="0 0 16 38" className="absolute -top-3 right-5 z-[2]" fill="none">
      <path
        d="M11 9v19a4 4 0 0 1-8 0V6a3 3 0 0 1 6 0v20a1.5 1.5 0 0 1-3 0V10"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const handText = "font-hand leading-[1.1]";

// ── Check-in cards ───────────────────────────────────────────────────────

interface CardProps {
  item: Extract<JournalItem, { kind: "checkin" }>;
  people: People;
  onOpen: () => void;
}

function captionBits(item: CardProps["item"], people: People) {
  return {
    name: authorName(item, people),
    day: format(new Date(item.c.completed_at), "EEE"),
    goal: item.c.goals?.title ?? "Goal",
    note: item.c.note,
  };
}

function Developing({ aspect }: { aspect: string }) {
  return (
    <div className="w-full flex items-center justify-center bg-gradient-to-br from-[#E7E1DA] to-[#CFC6BC] animate-pulse" style={{ aspectRatio: aspect }}>
      <span className="font-hand text-[18px] text-[#8A7B6E]">developing…</span>
    </div>
  );
}

function photoAspect(item: CardProps["item"], r: () => number): string {
  const m = item.c.completion_media?.[0];
  if (m?.width && m?.height) {
    // Clamp extreme panoramas / tall screenshots.
    const a = Math.min(Math.max(m.width / m.height, 0.62), 1.6);
    return String(a);
  }
  return pick(r, ["1", "0.8", "1.25", "0.75"]);
}

function Polaroid({ item, people, onOpen }: CardProps) {
  const r = seeded(item.id + ":card");
  const media = item.c.completion_media?.[0];
  const uploading = useIsUploading(item.id);
  const { name, day, goal, note } = captionBits(item, people);
  const aspect = photoAspect(item, r);
  return (
    <button onClick={onOpen} className="relative block w-full text-left bg-[#FFFEFB] p-[7px] pb-2.5 shadow-[0_2px_6px_rgba(60,40,20,0.14),0_10px_24px_-12px_rgba(60,40,20,0.3)]">
      <Tapes r={r} />
      {media ? (
        <div className="overflow-hidden bg-[#EDE6DD]" style={{ aspectRatio: aspect }}>
          <Photo path={media.storage_path} thumb className="w-full h-full object-cover" />
        </div>
      ) : uploading ? (
        <Developing aspect={aspect} />
      ) : null}
      <div className="px-1 pt-2">
        <p className={`${handText} text-[19px] text-[#3B332C] line-clamp-2`} dir="auto">{goal}</p>
        <p className={`${handText} text-[15px] text-[#8A7B6E] mt-0.5`}>{name} · {day}</p>
        {note && (
          <p className={`${handText} text-[16px] text-[#5A4E44] mt-1 line-clamp-3`} dir="auto">“{note}”</p>
        )}
      </div>
    </button>
  );
}

function Print({ item, people, onOpen }: CardProps) {
  const r = seeded(item.id + ":card");
  const media = item.c.completion_media?.[0];
  const uploading = useIsUploading(item.id);
  const { name, day, goal, note } = captionBits(item, people);
  const aspect = photoAspect(item, r);
  const labelTilt = between(r, -4, 3);
  return (
    <button onClick={onOpen} className="relative block w-full text-left">
      <div className="relative bg-white p-[4px] shadow-[0_2px_5px_rgba(60,40,20,0.16),0_12px_22px_-14px_rgba(60,40,20,0.35)]">
        <Tapes r={r} />
        {media ? (
          <div className="overflow-hidden bg-[#EDE6DD]" style={{ aspectRatio: aspect }}>
            <Photo path={media.storage_path} thumb className="w-full h-full object-cover" />
          </div>
        ) : uploading ? (
          <Developing aspect={aspect} />
        ) : null}
      </div>
      {/* Label-maker strip */}
      <div
        className="relative -mt-2.5 ml-2 inline-block bg-[#2B2522] text-[#F4EDE4] px-2 py-[3px] shadow-sm max-w-[92%]"
        style={{ transform: `rotate(${labelTilt}deg)` }}
      >
        <span className="block truncate font-mono text-[9px] tracking-[0.14em] uppercase">{goal} · {day}</span>
      </div>
      {note && (
        <p className={`${handText} text-[16px] text-[#4A3F36] mt-1.5 px-1 line-clamp-3`} dir="auto">
          {note} <span className="text-[#8A7B6E] text-[14px]">— {name}</span>
        </p>
      )}
    </button>
  );
}

const STICKY = ["#FFF1B8", "#FAD9CF", "#D6EDDC", "#D7E6F2", "#EFE0F5"] as const;

function IndexCard({ item, people, onOpen }: CardProps) {
  const r = seeded(item.id + ":card");
  const { name, day, goal, note } = captionBits(item, people);
  return (
    <button
      onClick={onOpen}
      className="relative block w-full text-left px-3 pt-2.5 pb-3 shadow-[0_2px_5px_rgba(60,40,20,0.12)]"
      style={{
        background:
          "linear-gradient(90deg, transparent 20px, rgba(214,120,120,0.45) 20px 21px, transparent 21px), repeating-linear-gradient(#FFFDF8 0 21px, rgba(120,160,200,0.32) 21px 22px)",
        backgroundColor: "#FFFDF8",
      }}
    >
      {r() < 0.5 ? <Tapes r={r} /> : <PaperClip />}
      <p className="pl-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[#8A7B6E] leading-[22px] truncate">{goal}</p>
      <p className={`pl-4 font-hand text-[18px] text-[#2F3A56] leading-[22px] line-clamp-5`} dir="auto">{note}</p>
      <p className="pl-4 font-hand text-[15px] text-[#8A7B6E] leading-[22px] text-right">— {name}, {day}</p>
    </button>
  );
}

function StickyNote({ item, people, onOpen }: CardProps) {
  const r = seeded(item.id + ":card");
  const color = pick(r, STICKY);
  const { name, day, goal, note } = captionBits(item, people);
  return (
    <button
      onClick={onOpen}
      className="relative block w-full text-left px-3.5 pt-4 pb-3.5"
      style={{
        background: `linear-gradient(180deg, ${color} 0%, ${color} 82%, color-mix(in srgb, ${color} 88%, #b09060) 100%)`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.08), 0 14px 18px -14px rgba(60,40,20,0.45)",
        borderBottomRightRadius: "18px 6px",
      }}
    >
      <span aria-hidden className="absolute top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#C4704F] shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
      <p className={`${handText} text-[19px] text-[#3B332C] line-clamp-5`} dir="auto">{note}</p>
      <p className={`${handText} text-[15px] text-[#6E6053] mt-2`}>{goal}</p>
      <p className={`${handText} text-[14px] text-[#8A7B6E]`}>{name} · {day}</p>
    </button>
  );
}

const INKS = ["#B5543A", "#3F6C8C", "#4F7A5E", "#7A5A8C"] as const;

function Stamp({ item, people, onOpen }: CardProps) {
  const r = seeded(item.id + ":card");
  const ink = pick(r, INKS);
  const { name, goal } = captionBits(item, people);
  const date = format(new Date(item.c.completed_at), "d MMM").toUpperCase();
  return (
    <button onClick={onOpen} className="relative block mx-auto text-center py-1" style={{ width: "86%" }}>
      <div
        className="rounded-[10px] px-2.5 py-2 mix-blend-multiply"
        style={{ border: `2px solid ${ink}`, color: ink, boxShadow: `inset 0 0 0 2px #fbf7f1, inset 0 0 0 3px ${ink}`, opacity: 0.88 }}
      >
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase">✓ done · {date}</p>
        <p className="font-mono text-[12px] font-bold tracking-[0.06em] uppercase leading-tight mt-0.5 line-clamp-2" dir="auto">{goal}</p>
        <p className="font-mono text-[9px] tracking-[0.16em] uppercase mt-0.5">{name}</p>
      </div>
    </button>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────

type Variant = "polaroid" | "print" | "index" | "sticky" | "stamp";

function variantFor(item: CardProps["item"]): Variant {
  const r = seeded(item.id + ":variant");
  const hasPhoto = (item.c.completion_media?.length ?? 0) > 0;
  if (hasPhoto) return r() < 0.62 ? "polaroid" : "print";
  if (item.c.note) return r() < 0.5 ? "index" : "sticky";
  return "stamp";
}

// Rough card height in column-widths, for balancing the two columns.
function estimateHeight(item: CardProps["item"], variant: Variant): number {
  const r = seeded(item.id + ":card");
  const noteLines = Math.min(5, Math.ceil((item.c.note?.length ?? 0) / 22));
  switch (variant) {
    case "polaroid":
    case "print": {
      const aspect = parseFloat(photoAspect(item, r)) || 1;
      return 1 / aspect + 0.32 + noteLines * 0.12;
    }
    case "index":
    case "sticky":
      return 0.45 + noteLines * 0.14;
    case "stamp":
      return 0.42;
  }
}

function CheckInCard(props: CardProps) {
  const variant = variantFor(props.item);
  const r = seeded(props.item.id + ":place");
  const tilt =
    variant === "stamp" ? between(r, -9, 9)
    : variant === "sticky" ? between(r, -4, 4)
    : between(r, -3.2, 3.2);
  const nudge = between(r, -5, 5);
  const gap = between(r, 14, 30);
  return (
    <div
      className="animate-journal-in"
      style={{ transform: `translateX(${nudge}px) rotate(${tilt}deg)`, marginTop: gap }}
    >
      {variant === "polaroid" && <Polaroid {...props} />}
      {variant === "print" && <Print {...props} />}
      {variant === "index" && <IndexCard {...props} />}
      {variant === "sticky" && <StickyNote {...props} />}
      {variant === "stamp" && <Stamp {...props} />}
    </div>
  );
}

// A landscape photo occasionally breaks out of the grid as a wide print.
function isWideFeature(item: CardProps["item"]): boolean {
  const m = item.c.completion_media?.[0];
  if (!m?.width || !m?.height || m.width / m.height < 1.25) return false;
  return seeded(item.id + ":wide")() < 0.35;
}

function WidePrint(props: CardProps) {
  const r = seeded(props.item.id + ":place");
  const side = r() < 0.5 ? "mr-auto" : "ml-auto";
  return (
    <div className={`w-[86%] ${side} animate-journal-in`} style={{ transform: `rotate(${between(r, -2.2, 2.2)}deg)`, marginTop: between(r, 18, 30) }}>
      <Polaroid {...props} />
    </div>
  );
}

function Masonry({ items, people, onOpen }: { items: CardProps["item"][]; people: People; onOpen: (id: string) => void }) {
  const cols: CardProps["item"][][] = [[], []];
  const heights = [0, 0.35]; // right column starts lower, like a real page
  for (const item of items) {
    const h = estimateHeight(item, variantFor(item));
    const target = heights[0] <= heights[1] ? 0 : 1;
    cols[target].push(item);
    heights[target] += h + 0.12;
  }
  return (
    <div className="flex gap-4 px-4">
      {cols.map((col, ci) => (
        <div key={ci} className="flex-1 min-w-0 flex flex-col" style={{ paddingTop: ci === 1 ? 26 : 0 }}>
          {col.map((item) => (
            <CheckInCard key={item.id} item={item} people={people} onOpen={() => onOpen(item.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Dream spread ─────────────────────────────────────────────────────────

const DreamSpread = forwardRef<HTMLElement, {
  item: Extract<JournalItem, { kind: "dream" }>;
  people: People;
  highlighted: boolean;
  onOpen: () => void;
}>(function DreamSpread({ item, people, highlighted, onOpen }, ref) {
  const { d } = item;
  const r = seeded(d.id + ":dream");
  const uploading = useIsUploading(d.id);
  const aspect =
    d.achieved_photo_width && d.achieved_photo_height
      ? String(Math.min(Math.max(d.achieved_photo_width / d.achieved_photo_height, 0.8), 1.6))
      : "1.25";
  const who =
    d.owner_id === null ? "Together"
    : d.owner_id === people.selfId ? people.selfName
    : people.partnerName;
  const date = d.achieved_at ? format(new Date(d.achieved_at), "MMMM d, yyyy") : "";
  const hasPhoto = !!d.achieved_photo_path;

  return (
    <article
      ref={ref}
      className={`relative mx-4 mt-10 mb-4 animate-journal-in ${highlighted ? "animate-highlight" : ""}`}
      style={{ transform: `rotate(${between(r, -1.4, 1.4)}deg)` }}
    >
      <button
        onClick={onOpen}
        className="relative block w-full text-left px-5 pt-8 pb-6 kraft-paper shadow-[0_3px_8px_rgba(60,40,20,0.16),0_22px_40px_-22px_rgba(60,40,20,0.5)]"
      >
        <Tape r={r} style={{ top: -8, left: -14, transform: "rotate(-32deg)", width: 64 }} />
        <Tape r={r} style={{ top: -8, right: -14, transform: "rotate(32deg)", width: 64 }} />

        {/* Ribbon */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-[3]">
          <div
            className="bg-primary text-white text-[10px] font-bold uppercase tracking-[0.2em] px-5 py-1.5 whitespace-nowrap shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
            style={{ clipPath: "polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%, 6% 50%)" }}
          >
            ✦ Dream achieved ✦
          </div>
        </div>

        {/* Sparkles */}
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden
            className="absolute text-[#D9A441] pointer-events-none"
            style={{
              top: `${between(r, 8, 88)}%`,
              left: i % 2 === 0 ? `${between(r, 2, 8)}%` : undefined,
              right: i % 2 === 1 ? `${between(r, 2, 8)}%` : undefined,
              fontSize: between(r, 10, 18),
              opacity: 0.8,
            }}
          >
            ✦
          </span>
        ))}

        {hasPhoto ? (
          <div className="relative mx-auto w-[92%] bg-white p-2 pb-2.5 shadow-[0_2px_6px_rgba(60,40,20,0.18)]" style={{ transform: `rotate(${between(r, -2, 2)}deg)` }}>
            <div className="overflow-hidden bg-[#EDE6DD]" style={{ aspectRatio: aspect }}>
              <Photo path={d.achieved_photo_path!} className="w-full h-full object-cover" />
            </div>
            {/* Wax seal */}
            <div
              aria-hidden
              className="absolute -bottom-4 -right-3 w-12 h-12 rounded-full flex items-center justify-center text-[#F7E3D6] text-[18px]"
              style={{
                background: "radial-gradient(circle at 35% 30%, #D98A6A, #A4492E 70%)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.25)",
                transform: `rotate(${between(r, -20, 20)}deg)`,
              }}
            >
              ✦
            </div>
          </div>
        ) : uploading ? (
          <div className="mx-auto w-[92%] bg-white p-2">
            <Developing aspect={aspect} />
          </div>
        ) : null}

        <h3
          className={`font-[family-name:var(--font-instrument-serif)] italic text-center text-[#2B221B] leading-[1.05] ${hasPhoto ? "text-[30px] mt-6" : "text-[38px] mt-3"}`}
          dir="auto"
        >
          {d.title}
        </h3>
        {d.achieved_note && (
          <p className="font-hand text-[21px] leading-[1.15] text-center text-[#5A4636] mt-2 px-2" dir="auto">
            “{d.achieved_note}”
          </p>
        )}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="h-px w-8 bg-[#B89F86]" />
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#8A735E] font-semibold">
            {date} · {who}
          </p>
          <span className="h-px w-8 bg-[#B89F86]" />
        </div>
      </button>
    </article>
  );
});

// ── Month + page ─────────────────────────────────────────────────────────

function MonthHeader({ date, count }: { date: Date; count: number }) {
  return (
    <div className="px-6 pt-10 pb-1 flex items-end gap-2">
      <div className="relative">
        <h2 className="font-hand text-[40px] leading-none text-[#3B332C]">{format(date, "MMMM")}</h2>
        <svg aria-hidden viewBox="0 0 140 10" className="absolute -bottom-2 left-0 w-full h-2.5" preserveAspectRatio="none">
          <path d="M2 6 C 20 1, 40 9, 60 5 S 100 2, 138 6" stroke="var(--primary)" strokeOpacity="0.55" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <span className="font-hand text-[22px] text-muted leading-none mb-0.5">{format(date, "yyyy")}</span>
      <span className="ml-auto font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-1">
        {count} {count === 1 ? "moment" : "moments"}
      </span>
    </div>
  );
}

type Block =
  | { type: "grid"; key: string; items: CardProps["item"][] }
  | { type: "wide"; key: string; item: CardProps["item"] }
  | { type: "dream"; key: string; item: Extract<JournalItem, { kind: "dream" }> };

function toBlocks(items: JournalItem[]): Block[] {
  const blocks: Block[] = [];
  let grid: CardProps["item"][] = [];
  const flush = () => {
    if (grid.length) blocks.push({ type: "grid", key: `g-${grid[0].id}`, items: grid });
    grid = [];
  };
  for (const item of items) {
    if (item.kind === "dream") {
      flush();
      blocks.push({ type: "dream", key: item.id, item });
    } else if (isWideFeature(item)) {
      flush();
      blocks.push({ type: "wide", key: item.id, item });
    } else {
      grid.push(item);
    }
  }
  flush();
  return blocks;
}

export function Scrapbook({
  items,
  people,
  onOpen,
  highlightId,
  highlightRef,
}: {
  items: JournalItem[];
  people: People;
  onOpen: (id: string) => void;
  highlightId?: string | null;
  highlightRef?: React.Ref<HTMLElement>;
}) {
  // Group by month (items are newest first).
  const months: { key: string; date: Date; items: JournalItem[] }[] = [];
  for (const item of items) {
    const d = new Date(item.date);
    const key = format(d, "yyyy-MM");
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(item);
    else months.push({ key, date: d, items: [item] });
  }

  return (
    <div>
      {months.map((m) => (
        <section key={m.key}>
          <MonthHeader date={m.date} count={m.items.length} />
          {toBlocks(m.items).map((b) =>
            b.type === "grid" ? (
              <Masonry key={b.key} items={b.items} people={people} onOpen={onOpen} />
            ) : b.type === "wide" ? (
              <div key={b.key} className="px-4">
                <WidePrint item={b.item} people={people} onOpen={() => onOpen(b.item.id)} />
              </div>
            ) : (
              <DreamSpread
                key={b.key}
                ref={b.item.id === highlightId ? highlightRef : undefined}
                item={b.item}
                people={people}
                highlighted={b.item.id === highlightId}
                onOpen={() => onOpen(b.item.id)}
              />
            )
          )}
        </section>
      ))}
    </div>
  );
}
