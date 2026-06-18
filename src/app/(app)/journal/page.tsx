"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import { useDreams } from "@/hooks/use-dreams";
import { getSignedPhotoUrlsWithThumbs, deletePhotos } from "@/utils/storage";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { JournalSkeleton } from "@/components/ui/page-skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { DreamRow } from "@/types/database";
import { Trash2, ImageOff, X } from "lucide-react";

interface JournalEntry {
  id: string;
  user_id: string;
  note: string | null;
  completed_at: string;
  goals: { title: string } | null;
  users: { display_name: string } | null;
  completion_media: { id: string; storage_path: string }[];
}

// A board item is either a check-in photo or a dream.
type JournalItem =
  | { kind: "photo"; date: number; entry: JournalEntry }
  | { kind: "dream"; date: number; dream: DreamRow };

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
const DREAM_W = 198;      // dreams are deliberately bigger than photo polaroids
const TAP_SLOP = 6;       // px of movement before a press counts as a drag, not a tap

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

// Shortest-column masonry with per-card jitter → dense but organic.
// Handles mixed photo + (bigger) dream cards via per-item width/height.
function buildLayout(items: JournalItem[]): { placements: CardPlacement[]; boardW: number; boardH: number } {
  const colH = new Array(NUM_COLS).fill(0);
  // give each column a slightly different starting offset so the top edge isn't a straight line
  for (let c = 0; c < NUM_COLS; c++) colH[c] = BOARD_PAD + seededRand(c * 31 + 5) * 40;

  const placements = items.map((it, i) => {
    let col = 0;
    for (let c = 1; c < NUM_COLS; c++) if (colH[c] < colH[col]) col = c;

    let w: number, cardH: number, cls = "";
    if (it.kind === "photo") {
      w = WIDTHS[seedInt(i * 13 + 1, WIDTHS.length)];
      const asp = ASPECTS[i % ASPECTS.length];
      cls = asp.cls;
      cardH = w * asp.r + 66 + (it.entry.note ? 26 : 0); // image + caption + tape/padding
    } else {
      w = DREAM_W;
      cardH = 150 + (it.dream.note ? 46 : 0);
    }

    const jitterX = (seededRand(i * 7 + 1) - 0.5) * 28;
    const jitterY = seededRand(i * 7 + 5) * 12;
    const x = BOARD_PAD + col * COL_W + jitterX;
    const y = colH[col] + jitterY;
    const gap = 10 + seededRand(i * 7 + 9) * 24;
    colH[col] = y + cardH + gap;
    return { x, y, w, rot: ROT[i % ROT.length], cls };
  });

  const boardW = BOARD_PAD * 2 + (NUM_COLS - 1) * COL_W + Math.max(170, DREAM_W + 30);
  const boardH = Math.max(BOARD_PAD, ...colH) + BOARD_PAD;
  return { placements, boardW, boardH };
}

// shared = primary, mine = muted, partner = partner accent (matches dreams page)
function dreamOwnerColor(dream: DreamRow, userId?: string): string {
  if (dream.owner_id === null) return "var(--primary)";
  if (dream.owner_id === userId) return "var(--muted)";
  return "var(--partner-accent)";
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

function PolaroidCard({ entry, index, isOwn, thumbUrl, fullUrl, width, rotation, aspectClass, onOpen, onRemovePhoto, onDeleteEntry }: {
  entry: JournalEntry;
  index: number;
  isOwn: boolean;
  thumbUrl?: string;
  fullUrl?: string;
  width?: number;        // fixed px in canvas mode; full-width in classic
  rotation?: number;     // canvas overrides the default tilt
  aspectClass?: string;  // canvas overrides the default aspect
  onOpen?: () => void;   // tap the photo → lightbox
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
            onClick={onOpen}
            className="w-full h-full object-cover cursor-zoom-in"
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

function DreamCard({ dream, index, ownerColor, width, rotation, onOpen }: {
  dream: DreamRow;
  index: number;
  ownerColor: string;
  width?: number;
  rotation?: number;
  onOpen?: () => void;
}) {
  const rot = rotation ?? FALLBACK_ROT[index % FALLBACK_ROT.length];
  const tapeAngle = index % 3 === 0 ? 3 : index % 3 === 1 ? -3 : 2;
  const achieved = dream.achieved_at !== null;
  const accent = achieved ? "var(--success)" : ownerColor;

  return (
    <div
      onClick={onOpen}
      className="relative rounded-lg p-3.5 cursor-pointer"
      style={{
        width: width ?? "100%",
        background: "linear-gradient(160deg,#fffdf9 0%,#f6eee4 100%)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.17),0 0 0 0.5px rgba(0,0,0,0.05)",
        transform: `rotate(${rot}deg)`,
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <TapeStrip angle={tapeAngle} />

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[26px] leading-none">{dream.emoji || "✨"}</span>
        <span
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em]"
          style={{ color: accent }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
          {achieved ? "Achieved" : "Dream"}
        </span>
      </div>

      <h3
        className="font-[family-name:var(--font-instrument-serif)] italic text-[18px] text-[--foreground] leading-tight"
        dir={isRTL(dream.title) ? "rtl" : "ltr"}
      >
        {dream.title}
      </h3>

      {dream.note && (
        <p
          className="text-[11px] text-[#7a6f64] mt-1.5 line-clamp-3 leading-snug"
          dir={isRTL(dream.note) ? "rtl" : "ltr"}
        >
          {dream.note}
        </p>
      )}
    </div>
  );
}

// --- Page ---
export default function JournalPage() {
  const { user } = useAuth();
  const { couple, partner } = useAppData();
  const { dreams } = useDreams(couple?.id);
  const confirm = useConfirm();
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
  const downPos = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false); // true once a press turns into a drag/pinch — suppresses tap actions
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

  // Close the lightbox with Escape
  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxUrl(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  const inTimeWindow = useCallback((iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (timeFilter === "thisMonth") return d >= startOfMonth(now);
    if (timeFilter === "lastMonth") return d >= startOfMonth(subMonths(now, 1)) && d <= endOfMonth(subMonths(now, 1));
    if (timeFilter === "thisYear") return d >= startOfYear(now);
    return true;
  }, [timeFilter]);

  // Unified, date-ordered board: photos + dreams merged newest-first
  const items = useMemo<JournalItem[]>(() => {
    const photoItems: JournalItem[] = entries
      .filter(e => {
        if (personFilter === "me" && e.user_id !== user?.id) return false;
        if (personFilter === "partner" && e.user_id === user?.id) return false;
        return inTimeWindow(e.completed_at);
      })
      .map(e => ({ kind: "photo", date: new Date(e.completed_at).getTime(), entry: e }));

    const dreamItems: JournalItem[] = dreams
      .filter(d => {
        // shared dreams belong to both; personal dreams only to their owner
        if (personFilter === "me" && !(d.owner_id === user?.id || d.owner_id === null)) return false;
        if (personFilter === "partner" && !(d.owner_id === partner?.id || d.owner_id === null)) return false;
        return inTimeWindow(d.achieved_at ?? d.created_at);
      })
      .map(d => ({ kind: "dream", date: new Date(d.achieved_at ?? d.created_at).getTime(), dream: d }));

    return [...photoItems, ...dreamItems].sort((a, b) => b.date - a.date);
  }, [entries, dreams, personFilter, timeFilter, user?.id, partner?.id, inTimeWindow]);

  const photoCount = useMemo(() => items.filter(it => it.kind === "photo").length, [items]);

  const { placements, boardW, boardH } = useMemo(() => buildLayout(items), [items]);

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

  // Recenter the board on the current item set
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
    downPos.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(activePointers.current.values());

    if (pts.length >= 2) {
      movedRef.current = true; // a pinch is never a tap
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (lastPinchDist.current !== null && lastPinchDist.current > 0) {
        applyZoom(scaleRef.current * (dist / lastPinchDist.current), midX, midY);
      }
      lastPinchDist.current = dist;
    } else {
      if (Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y) > TAP_SLOP) {
        movedRef.current = true;
      }
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
    // Remove the storage file(s) before the DB row (RLS on storage needs the row's path scope)
    await deletePhotos([media.storage_path]);
    await supabase.from("completion_media").delete().eq("id", media.id);
    load();
  }

  async function handleDeleteEntry(entry: JournalEntry) {
    const ok = await confirm({
      title: "Delete check-in?",
      message: "This removes the check-in and its photo. This cannot be undone.",
      destructive: true,
    });
    if (!ok) return;
    const paths = entry.completion_media?.map((m) => m.storage_path) ?? [];
    await deletePhotos(paths);
    await supabase.from("completions").delete().eq("id", entry.id);
    load();
  }

  // Open the photo lightbox unless the press was actually a drag/pinch
  function openPhoto(entry: JournalEntry) {
    if (movedRef.current) return;
    const photo = entry.completion_media?.[0];
    if (!photo) return;
    const url = fullUrls[photo.storage_path] ?? thumbUrls[photo.storage_path];
    if (url) setLightboxUrl(url);
  }

  function openDreams() {
    if (movedRef.current) return;
    router.push("/dreams");
  }

  function photoUrlsFor(entry: JournalEntry) {
    const p = entry.completion_media?.[0];
    return {
      thumbUrl: p ? thumbUrls[p.storage_path] : undefined,
      fullUrl: p ? fullUrls[p.storage_path] : undefined,
    };
  }

  if (loading) return <JournalSkeleton />;

  const partnerName = partner?.display_name ?? "Partner";

  const lightbox = lightboxUrl && (
    <div
      className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center"
      onClick={() => setLightboxUrl(null)}
    >
      <button
        onClick={() => setLightboxUrl(null)}
        className="absolute right-4 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-95 transition-transform"
        style={{ top: "calc(16px + env(safe-area-inset-top))" }}
        aria-label="Close"
      >
        <X size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lightboxUrl}
        alt="Check-in"
        className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );

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
      {photoCount > 0 && (
        <p className="text-[11px] text-[--muted] mt-0.5">{photoCount} memories</p>
      )}
    </div>
  );

  const emptyState = (
    <div className="flex-1 flex items-center justify-center text-[--muted] text-[14px] px-8 text-center">
      {entries.length === 0 && dreams.length === 0
        ? "No check-ins yet. Complete a goal to see it here."
        : "Nothing matches these filters."}
    </div>
  );

  // --- Classic: two-column scroll, dreams as full-width breaks ---
  if (layout === "classic") {
    const blocks: React.ReactNode[] = [];
    let buf: { entry: JournalEntry; idx: number }[] = [];
    let key = 0;
    const flush = () => {
      if (buf.length === 0) return;
      const left = buf.filter((_, i) => i % 2 === 0);
      const right = buf.filter((_, i) => i % 2 !== 0);
      const photoCard = (b: { entry: JournalEntry; idx: number }) => {
        const { thumbUrl, fullUrl } = photoUrlsFor(b.entry);
        return (
          <PolaroidCard
            key={b.entry.id}
            entry={b.entry}
            index={b.idx}
            isOwn={b.entry.user_id === user?.id}
            thumbUrl={thumbUrl}
            fullUrl={fullUrl}
            onOpen={() => openPhoto(b.entry)}
            onRemovePhoto={handleRemovePhoto}
            onDeleteEntry={handleDeleteEntry}
          />
        );
      };
      blocks.push(
        <div key={`p${key++}`} className="flex gap-2.5">
          <div className="flex-1 flex flex-col gap-5">{left.map(photoCard)}</div>
          <div className="flex-1 flex flex-col gap-5 pt-8">{right.map(photoCard)}</div>
        </div>
      );
      buf = [];
    };

    items.forEach((it, i) => {
      if (it.kind === "photo") {
        buf.push({ entry: it.entry, idx: i });
      } else {
        flush();
        blocks.push(
          <DreamCard
            key={it.dream.id}
            dream={it.dream}
            index={i}
            ownerColor={dreamOwnerColor(it.dream, user?.id)}
            onOpen={() => router.push("/dreams")}
          />
        );
      }
    });
    flush();

    return (
      <div className="fixed inset-0 flex flex-col bg-[--background]" style={{ paddingBottom: "calc(62px + env(safe-area-inset-bottom))" }}>
        {Header}
        {FilterBar}
        {items.length === 0 ? emptyState : (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="flex flex-col gap-5 px-4 pt-3 pb-8">{blocks}</div>
          </div>
        )}
        {lightbox}
      </div>
    );
  }

  // --- Canvas: free pan + zoom collage ---
  return (
    <div className="fixed inset-0 flex flex-col bg-[--background]" style={{ paddingBottom: "calc(62px + env(safe-area-inset-bottom))" }}>
      {Header}
      {FilterBar}
      {items.length === 0 ? emptyState : (
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
            {items.map((it, i) => {
              const p = placements[i];
              if (!p) return null;
              return (
                <div key={it.kind === "photo" ? it.entry.id : it.dream.id} style={{ position: "absolute", left: p.x, top: p.y }}>
                  {it.kind === "photo" ? (
                    (() => {
                      const { thumbUrl, fullUrl } = photoUrlsFor(it.entry);
                      return (
                        <PolaroidCard
                          entry={it.entry}
                          index={i}
                          isOwn={it.entry.user_id === user?.id}
                          width={p.w}
                          rotation={p.rot}
                          aspectClass={p.cls}
                          thumbUrl={thumbUrl}
                          fullUrl={fullUrl}
                          onOpen={() => openPhoto(it.entry)}
                          onRemovePhoto={handleRemovePhoto}
                          onDeleteEntry={handleDeleteEntry}
                        />
                      );
                    })()
                  ) : (
                    <DreamCard
                      dream={it.dream}
                      index={i}
                      ownerColor={dreamOwnerColor(it.dream, user?.id)}
                      width={p.w}
                      rotation={p.rot}
                      onOpen={openDreams}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {lightbox}
    </div>
  );
}
