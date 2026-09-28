"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { X, Trash2, ImageOff } from "lucide-react";
import { Photo } from "@/components/ui/photo";
import { authorName, type JournalItem, type People } from "@/components/journal/scrapbook";

// Full-screen viewer for journal entries: swipe sideways between entries,
// swipe down (or tap ×) to close.
export function Lightbox({
  items,
  index,
  people,
  onIndex,
  onClose,
  onDelete,
  onRemovePhoto,
}: {
  items: JournalItem[];
  index: number;
  people: People;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDelete: (item: JournalItem) => void;
  onRemovePhoto: (item: JournalItem) => void;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const item = items[index];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, items.length, onClose, onIndex]);

  if (!item || typeof document === "undefined") return null;

  function onTouchStart(e: React.TouchEvent) {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null };
    setDragging(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    const s = start.current;
    if (!s) return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    if (!s.axis && Math.hypot(dx, dy) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (s.axis === "x") setDrag({ x: dx, y: 0 });
    if (s.axis === "y") setDrag({ x: 0, y: Math.max(0, dy) });
  }
  function onTouchEnd() {
    setDragging(false);
    if (drag.y > 110) onClose();
    else if (drag.x < -60 && index < items.length - 1) onIndex(index + 1);
    else if (drag.x > 60 && index > 0) onIndex(index - 1);
    setDrag({ x: 0, y: 0 });
    start.current = null;
  }

  const isOwn =
    item.kind === "checkin" ? item.c.user_id === people.selfId : item.d.owner_id === null || item.d.owner_id === people.selfId;
  const photoPath =
    item.kind === "checkin" ? item.c.completion_media?.[0]?.storage_path : item.d.achieved_photo_path ?? undefined;
  const title = item.kind === "checkin" ? item.c.goals?.title ?? "Goal" : item.d.title;
  const note = item.kind === "checkin" ? item.c.note : item.d.achieved_note;
  const when = format(new Date(item.date), "EEEE, MMMM d · h:mm a");
  const fade = 1 - Math.min(drag.y / 400, 0.6);

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex flex-col text-[#F6EFE7]"
      style={{ background: `rgba(20,16,13,${fade})` }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
        <span className="font-mono text-[11px] tracking-[0.14em] text-[#BFAF9F]">
          {index + 1} / {items.length}
        </span>
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <X size={20} />
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center px-3 min-h-0"
        style={{
          transform: `translate(${drag.x}px, ${drag.y}px) scale(${1 - drag.y / 1600})`,
          transition: dragging ? "none" : "transform 220ms ease-out",
        }}
      >
        {photoPath ? (
          <div key={photoPath} className="relative w-full h-full flex items-center justify-center">
            {/* Thumbnail underneath shows instantly while the full photo loads. */}
            <Photo path={photoPath} thumb eager className="absolute inset-0 m-auto max-w-full max-h-full object-contain" />
            <Photo path={photoPath} eager className="relative max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <div className="w-full max-w-[380px] bg-[#FFFDF8] text-[#2F3A56] px-6 py-8 shadow-2xl -rotate-1">
            <p className="font-hand text-[30px] leading-[1.15] text-center" dir="auto">{note || title}</p>
          </div>
        )}
      </div>

      <div className="px-5 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}>
        {item.kind === "dream" && (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E7A98C] mb-1">✦ Dream achieved</p>
        )}
        <p className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] leading-tight" dir="auto">{title}</p>
        {note && photoPath && (
          <p className="font-hand text-[21px] leading-snug text-[#E9DDD0] mt-1" dir="auto">“{note}”</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <p className="text-[12px] text-[#BFAF9F] flex-1">{authorName(item, people)} · {when}</p>
          {isOwn && item.kind === "checkin" && (
            <>
              {photoPath && (
                <button
                  onClick={() => onRemovePhoto(item)}
                  aria-label="Remove photo"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
                >
                  <ImageOff size={16} />
                </button>
              )}
              <button
                onClick={() => onDelete(item)}
                aria-label="Delete check-in"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 text-[#F2A38C]"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
