"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import { getSignedPhotoUrlsWithThumbs } from "@/utils/storage";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { JournalSkeleton } from "@/components/ui/page-skeleton";
import { Trash2, ImageOff } from "lucide-react";

interface JournalEntry {
  id: string;
  user_id: string;
  note: string | null;
  completed_at: string;
  goals: { title: string } | null;
  users: { display_name: string } | null;
  completion_media: { id: string; storage_path: string }[];
}

type PersonFilter = "all" | "me" | "partner";
type TimeFilter = "all" | "thisMonth" | "lastMonth" | "thisYear";
type Layout = "classic" | "canvas";

// --- Canvas collage layout ---
const NUM_COLS = 4;
const COL_W = 128;        // column stride; cards are wider than this on purpose → overlap
const BOARD_PAD = 28;
const PAN_MARGIN = 80;    // keep at least this many px of board on screen
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.4;
const INIT_SCALE = 0.82;

const WIDTHS = [120, 134, 150, 126, 144];
const ROT = [-5, 3.2, -2.5, 4.6, -3.6, 2.1, -4.2, 5.1, -1.6, 3.7, -2.9, 4.1];
const ASPECTS = [
  { cls: "aspect-square", r: 1 },
  { cls: "aspect-[4/3]", r: 0.75 },
  { cls: "aspect-[3/4]", r: 1.333 },
  { cls: "aspect-[4/3]", r: 0.75 },
  { cls: "aspect-square", r: 1 },
  { cls: "aspect-[5/4]", r: 0.8 },
  { cls: "aspect-[3/4]", r: 1.333 },
  { cls: "aspect-square", r: 1 },
];

// Seeded LCG so each card's scatter is stable across re-renders
function seededRand(seed: number): number {
  return ((seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}
function seedInt(seed: number, mod: number): number {
  return Math.floor(seededRand(seed) * mod) % mod;
}

interface CardPlacement { x: number; y: number; w: number; rot: number; cls: string }

// Shortest-column masonry with per-card jitter → dense but organic
function buildLayout(entries: JournalEntry[]): { placements: CardPlacement[]; boardW: number; boardH: number } {
  const colH = new Array(NUM_COLS).fill(BOARD_PAD + seededRand(99) * 26);
  // give each column a slightly different starting offset so the top edge isn't a straight line
  for (let c = 0; c < NUM_COLS; c++) colH[c] = BOARD_PAD + seededRand(c * 31 + 5) * 40;

  const placements = entries.map((entry, i) => {
    let col = 0;
    for (let c = 1; c < NUM_COLS; c++) if (colH[c] < colH[col]) col = c;

    const w = WIDTHS[seedInt(i * 13 + 1, WIDTHS.length)];
    const asp = ASPECTS[i % ASPECTS.length];
    const imgH = w * asp.r;
    const cardH = imgH + 66 + (entry.note ? 26 : 0); // image + caption + tape/padding
    const jitterX = (seededRand(i * 7 + 1) - 0.5) * 32;
    const jitterY = seededRand(i * 7 + 5) * 12;
    const x = BOARD_PAD + col * COL_W + jitterX;
    const y = colH[col] + jitterY;
    const gap = 10 + seededRand(i * 7 + 9) * 24;
    colH[col] = y + cardH + gap;
    return { x, y, w, rot: ROT[i % ROT.length], cls: asp.cls };
  });

  const boardW = BOARD_PAD * 2 + (NUM_COLS - 1) * COL_W + 170;
  const boardH = Math.max(BOARD_PAD, ...colH) + BOARD_PAD;
  return { placements, boardW, boardH };
}

// --- Sub-components ---
const FALLBACK_ROT = [-1.5, 1.2, -0.8, 1.8, -1.2, 0.6, -0.4, 1.6, -1.0, 0.9];
const FALLBACK_ASPECT = ["aspect-square", "aspect-[4/3]", "aspect-[3/4]", "aspect-[4/3]", "aspect-square", "aspect-[3/4]"];
const GRAD_BG = [
  "linear-gradient(135deg,#f5e6d8 0%,#e8d5c4 100%)",
  "linear-gradient(135deg,#dce8f0 0%,#c8dce8 100%)",
  "linear-gradient(135deg,#e8e4f0 0%,#d8d2e8 100%)",
  "linear-gradient(135deg,#d8ece0 0%,#c8e0d0 100%)",
  "linear-gradient(135deg,#f0ece0 0%,#e4dcc8 100%)",
  "linear-gradient(135deg,#ece0e8 0%,#dcc8d8 100%)",
];

function isRTL(text: string) {
  return /[֐-׿؀-ۿ]/.test(text[0] ?? "");
}

function TapeStrip({ angle = 0 }: { angle?: number }) {
  return (
    <div style={{
      position: "absolute", top: -8, left: "50%",
      transform: `translateX(-50%) rotate(${angle}deg)`,
      width: 44, height: 18,
      background: "rgba(255,230,180,0.55)",
      borderRadius: 2, zIndex: 2,
      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
    }} />
  );
}

function DeleteMenu({ hasPhoto, onRemovePhoto, onDeleteEntry, onClose }: {
  hasPhoto: boolean;
  onRemovePhoto: () => void;
  onDeleteEntry: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-white rounded-xl shadow-lg border border-[--border] overflow-hidden"
        style={{ minWidth: 160 }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {hasPhoto && (
          <button
            onClick={onRemovePhoto}
            className="flex items-center gap-2.5 w-full px-4 py-3 text-[13px] text-[--foreground] hover:bg-[--surface] transition-colors border-b border-[--border]"
          >
            <ImageOff size={14} className="text-[--muted]" />
            Remove photo
          </button>
        )}
        <button
          onClick={onDeleteEntry}
          className="flex items-center gap-2.5 w-full px-4 py-3 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
          Delete check-in
        </button>
      </div>
    </>
  );
}

function PolaroidCard({ entry, index, isOwn, thumbUrl, fullUrl, width, rotation, aspectClass, onRemovePhoto, onDeleteEntry }: {
  entry: JournalEntry;
  index: number;
  isOwn: boolean;
  thumbUrl?: string;
  fullUrl?: string;
  width?: number;        // fixed px in canvas mode; full-width in classic
  rotation?: number;     // canvas overrides the default tilt
  aspectClass?: string;  // canvas overrides the default aspect
  onRemovePhoto: (e: JournalEntry) => void;
  onDeleteEntry: (e: JournalEntry) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rot = rotation ?? FALLBACK_ROT[index % FALLBACK_ROT.length];
  const asp = aspectClass ?? FALLBACK_ASPECT[index % FALLBACK_ASPECT.length];
  const gradBg = GRAD_BG[index % GRAD_BG.length];
  const tapeAngle = index % 3 === 0 ? -4 : index % 3 === 1 ? 3 : -2;

  const photo = entry.completion_media?.[0];
  const photoSrc = thumbUrl ?? fullUrl;
  const name = entry.users?.display_name ?? "Someone";
  const dateLabel = format(new Date(entry.completed_at), "MMM d");
  const goalTitle = entry.goals?.title ?? "Goal";

  return (
    <div
      className="relative bg-white rounded-sm p-2 pb-7"
      style={{
        width: width ?? "100%",
        boxShadow: "0 4px 14px rgba(0,0,0,0.15),0 0 0 0.5px rgba(0,0,0,0.06)",
        transform: `rotate(${rot}deg)`,
      }}
    >
      <TapeStrip angle={tapeAngle} />

      <div className={`w-full ${asp} overflow-hidden bg-[--surface-alt] relative`}>
        {photo && photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt="Check-in"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={thumbUrl && fullUrl ? (e) => {
              if (e.currentTarget.src !== fullUrl) e.currentTarget.src = fullUrl;
            } : undefined}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: gradBg }}>
            <div className="w-8 h-8 rounded-full bg-white/30" />
          </div>
        )}
      </div>

      <div className="pt-2 px-0.5">
        <p className="text-[10px] font-semibold text-[#666] uppercase tracking-[0.05em]">
          {name} · {dateLabel}
        </p>
        <p className="text-[10px] text-[#999] mt-0.5 truncate">{goalTitle}</p>
        {entry.note && (
          <p
            className="text-[10px] italic text-[#777] mt-1 line-clamp-2"
            dir={isRTL(entry.note) ? "rtl" : "ltr"}
          >
            &ldquo;{entry.note}&rdquo;
          </p>
        )}
      </div>

      {isOwn && (
        <div className="relative">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setMenuOpen(v => !v)}
            className="absolute bottom-0 right-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-white/80 text-[#bbb] hover:text-[#888] transition-colors"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
          >
            <Trash2 size={11} />
          </button>
          {menuOpen && (
            <DeleteMenu
              hasPhoto={!!photo}
              onRemovePhoto={() => { setMenuOpen(false); onRemovePhoto(entry); }}
              onDeleteEntry={() => { setMenuOpen(false); onDeleteEntry(entry); }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// --- Page ---
export default function JournalPage() {
  const { user } = useAuth();
  const { couple, partner } = useAppData();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Layout preference (set on the Profile page, stored per-device)
  const [layout, setLayout] = useState<Layout>("canvas");
  useEffect(() => {
    const saved = localStorage.getItem("journal_layout");
    if (saved === "classic" || saved === "canvas") setLayout(saved);
  }, []);

  // Pan + zoom (canvas mode). Refs are the source of truth so rapid
  // gestures don't fight stale state; state mirrors them to trigger renders.
  const canvasRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(INIT_SCALE);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [scale, setScale] = useState(INIT_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPanPos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  // Filters
  const [personFilter, setPersonFilter] = useState<PersonFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const load = useCallback(async () => {
    if (!couple) return;
    const { data } = await supabase
      .from("completions")
      .select("id, user_id, note, completed_at, goals!inner(title, couple_id), users(display_name), completion_media(id, storage_path)")
      .eq("goals.couple_id", couple.id)
      .order("completed_at", { ascending: false })
      .limit(100);

    const list = (data ?? []) as unknown as JournalEntry[];
    setEntries(list);
    const paths = list.flatMap((e) => e.completion_media?.map((m) => m.storage_path) ?? []);
    const { thumbs, fulls } = await getSignedPhotoUrlsWithThumbs(paths);
    setThumbUrls(thumbs);
    setFullUrls(fulls);
    setLoading(false);
  }, [couple?.id]);

  useEffect(() => { load(); }, [load]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (personFilter === "me") list = list.filter(e => e.user_id === user?.id);
    else if (personFilter === "partner") list = list.filter(e => e.user_id !== user?.id);

    const now = new Date();
    if (timeFilter === "thisMonth") {
      const start = startOfMonth(now);
      list = list.filter(e => new Date(e.completed_at) >= start);
    } else if (timeFilter === "lastMonth") {
      const start = startOfMonth(subMonths(now, 1));
      const end = endOfMonth(subMonths(now, 1));
      list = list.filter(e => { const d = new Date(e.completed_at); return d >= start && d <= end; });
    } else if (timeFilter === "thisYear") {
      const start = startOfYear(now);
      list = list.filter(e => new Date(e.completed_at) >= start);
    }
    return list;
  }, [entries, personFilter, timeFilter, user?.id]);

  const { placements, boardW, boardH } = useMemo(() => buildLayout(filteredEntries), [filteredEntries]);

  function clampOffset(x: number, y: number, s: number) {
    const el = canvasRef.current;
    if (!el) return { x, y };
    const vw = el.clientWidth, vh = el.clientHeight;
    const sw = boardW * s, sh = boardH * s;
    return {
      x: Math.min(vw - PAN_MARGIN, Math.max(PAN_MARGIN - sw, x)),
      y: Math.min(vh - PAN_MARGIN, Math.max(PAN_MARGIN - sh, y)),
    };
  }

  function commit(s: number, o: { x: number; y: number }) {
    scaleRef.current = s;
    offsetRef.current = o;
    setScale(s);
    setOffset(o);
  }

  // Zoom while keeping a focal point (in client coords) anchored in place
  function applyZoom(rawScale: number, focalClientX: number, focalClientY: number) {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fx = focalClientX - rect.left;
    const fy = focalClientY - rect.top;
    const prev = scaleRef.current;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
    const k = next / prev;
    const o = offsetRef.current;
    const nx = fx - (fx - o.x) * k;
    const ny = fy - (fy - o.y) * k;
    commit(next, clampOffset(nx, ny, next));
  }

  // Recenter the board on the current filter set
  const recenter = useCallback(() => {
    const el = canvasRef.current;
    const s = INIT_SCALE;
    if (!el) { commit(s, { x: 0, y: 0 }); return; }
    const vw = el.clientWidth;
    const x = Math.min(BOARD_PAD, (vw - boardW * s) / 2);
    commit(s, clampOffset(x, BOARD_PAD * s, s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardW, boardH]);

  // Re-home the view whenever the filtered set changes
  useEffect(() => { recenter(); }, [personFilter, timeFilter, recenter]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button,a")) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastPanPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(activePointers.current.values());

    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (lastPinchDist.current !== null && lastPinchDist.current > 0) {
        applyZoom(scaleRef.current * (dist / lastPinchDist.current), midX, midY);
      }
      lastPinchDist.current = dist;
    } else {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      const o = offsetRef.current;
      commit(scaleRef.current, clampOffset(o.x + dx, o.y + dy, scaleRef.current));
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) lastPinchDist.current = null;
    if (activePointers.current.size === 1) {
      const remaining = Array.from(activePointers.current.values())[0];
      lastPanPos.current = { x: remaining.x, y: remaining.y };
    }
  }

  function onWheel(e: React.WheelEvent) {
    // overflow is hidden here, so nothing scrolls — no preventDefault needed
    applyZoom(scaleRef.current * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY);
  }

  async function handleRemovePhoto(entry: JournalEntry) {
    const media = entry.completion_media?.[0];
    if (!media) return;
    await supabase.from("completion_media").delete().eq("id", media.id);
    load();
  }

  async function handleDeleteEntry(entry: JournalEntry) {
    if (!window.confirm("Delete this check-in? This cannot be undone.")) return;
    await supabase.from("completions").delete().eq("id", entry.id);
    load();
  }

  if (loading) return <JournalSkeleton />;

  const partnerName = partner?.display_name ?? "Partner";

  const FilterBar = (
    <div className="px-5 pt-3 pb-2 flex-shrink-0">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(["all", "me", "partner"] as PersonFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setPersonFilter(f)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-medium border transition-colors duration-150"
            style={{
              background: personFilter === f ? "var(--primary)" : "var(--surface)",
              borderColor: personFilter === f ? "var(--primary)" : "var(--border)",
              color: personFilter === f ? "#fff" : "var(--muted)",
            }}
          >
            {f === "all" ? "Everyone" : f === "me" ? "You" : partnerName}
          </button>
        ))}
        <div className="w-px self-stretch bg-[--border] flex-shrink-0 mx-0.5" />
        {(["all", "thisMonth", "lastMonth", "thisYear"] as TimeFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setTimeFilter(f)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-medium border transition-colors duration-150"
            style={{
              background: timeFilter === f ? "var(--primary)" : "var(--surface)",
              borderColor: timeFilter === f ? "var(--primary)" : "var(--border)",
              color: timeFilter === f ? "#fff" : "var(--muted)",
            }}
          >
            {f === "all" ? "All time" : f === "thisMonth" ? "This month" : f === "lastMonth" ? "Last month" : "This year"}
          </button>
        ))}
      </div>
    </div>
  );

  const Header = (
    <div className="px-5 flex-shrink-0" style={{ paddingTop: "calc(56px + env(safe-area-inset-top))" }}>
      <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground] leading-none">
        Journal
      </h1>
      {filteredEntries.length > 0 && (
        <p className="text-[11px] text-[--muted] mt-0.5">{filteredEntries.length} memories</p>
      )}
    </div>
  );

  const emptyState = (
    <div className="flex-1 flex items-center justify-center text-[--muted] text-[14px] px-8 text-center">
      {entries.length === 0 ? "No check-ins yet. Complete a goal to see it here." : "No check-ins match these filters."}
    </div>
  );

  // --- Classic: two-column scroll ---
  if (layout === "classic") {
    const leftEntries = filteredEntries.filter((_, i) => i % 2 === 0);
    const rightEntries = filteredEntries.filter((_, i) => i % 2 !== 0);
    return (
      <div className="fixed inset-0 flex flex-col bg-[--background]" style={{ paddingBottom: "calc(62px + env(safe-area-inset-bottom))" }}>
        {Header}
        {FilterBar}
        {filteredEntries.length === 0 ? emptyState : (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="flex gap-2.5 px-4 pt-3 pb-8">
              <div className="flex-1 flex flex-col gap-5">
                {leftEntries.map((entry, i) => (
                  <PolaroidCard
                    key={entry.id}
                    entry={entry}
                    index={i * 2}
                    isOwn={entry.user_id === user?.id}
                    thumbUrl={entry.completion_media?.[0] ? thumbUrls[entry.completion_media[0].storage_path] : undefined}
                    fullUrl={entry.completion_media?.[0] ? fullUrls[entry.completion_media[0].storage_path] : undefined}
                    onRemovePhoto={handleRemovePhoto}
                    onDeleteEntry={handleDeleteEntry}
                  />
                ))}
              </div>
              <div className="flex-1 flex flex-col gap-5 pt-8">
                {rightEntries.map((entry, i) => (
                  <PolaroidCard
                    key={entry.id}
                    entry={entry}
                    index={i * 2 + 1}
                    isOwn={entry.user_id === user?.id}
                    thumbUrl={entry.completion_media?.[0] ? thumbUrls[entry.completion_media[0].storage_path] : undefined}
                    fullUrl={entry.completion_media?.[0] ? fullUrls[entry.completion_media[0].storage_path] : undefined}
                    onRemovePhoto={handleRemovePhoto}
                    onDeleteEntry={handleDeleteEntry}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Canvas: free pan + zoom collage ---
  return (
    <div className="fixed inset-0 flex flex-col bg-[--background]" style={{ paddingBottom: "calc(62px + env(safe-area-inset-bottom))" }}>
      {Header}
      {FilterBar}
      {filteredEntries.length === 0 ? emptyState : (
        <div
          ref={canvasRef}
          className="flex-1 overflow-hidden relative"
          style={{ cursor: "grab", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <div
            style={{
              position: "absolute",
              width: boardW,
              height: boardH,
              transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              willChange: "transform",
            }}
          >
            {filteredEntries.map((entry, i) => {
              const p = placements[i];
              if (!p) return null;
              return (
                <div key={entry.id} style={{ position: "absolute", left: p.x, top: p.y }}>
                  <PolaroidCard
                    entry={entry}
                    index={i}
                    isOwn={entry.user_id === user?.id}
                    width={p.w}
                    rotation={p.rot}
                    aspectClass={p.cls}
                    thumbUrl={entry.completion_media?.[0] ? thumbUrls[entry.completion_media[0].storage_path] : undefined}
                    fullUrl={entry.completion_media?.[0] ? fullUrls[entry.completion_media[0].storage_path] : undefined}
                    onRemovePhoto={handleRemovePhoto}
                    onDeleteEntry={handleDeleteEntry}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
