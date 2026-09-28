"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActions } from "@/lib/actions";
import type { GoalWithCompletions } from "@/types/database";

const HOLD_MS = 450;

// "+" check-in button. Tap → full check-in page (photo + note).
// Press and hold → log instantly, with an Undo toast.
export function CheckInButton({
  goal,
  subdued = false,
  size = 26,
}: {
  goal: GoalWithCompletions;
  /** Target already met — render as a quieter "log extra" button. */
  subdued?: boolean;
  size?: number;
}) {
  const router = useRouter();
  const { quickCheckIn } = useActions();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const [holding, setHolding] = useState(false);
  const color = goal.color ?? "#374151";
  const href = `/check-in/${goal.id}`;

  useEffect(() => {
    router.prefetch(href);
  }, [router, href]);

  function start(e: React.PointerEvent) {
    e.stopPropagation();
    fired.current = false;
    setHolding(true);
    timer.current = setTimeout(() => {
      fired.current = true;
      setHolding(false);
      void quickCheckIn(goal);
    }, HOLD_MS);
  }

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }

  return (
    <button
      type="button"
      aria-label={`Check in on ${goal.title}. Press and hold to log instantly.`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (fired.current) return;
        router.push(href);
      }}
      className="relative flex items-center justify-center rounded-full font-semibold leading-none flex-shrink-0 select-none active:scale-95 transition-transform"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.68,
        WebkitTouchCallout: "none",
        background: subdued ? "transparent" : `color-mix(in srgb, ${color} 15%, transparent)`,
        border: subdued ? "1.5px dashed var(--border)" : `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        color: subdued ? "var(--muted)" : color,
      }}
    >
      {/* Fill ring while holding */}
      <span
        aria-hidden
        className="absolute inset-[-3px] rounded-full pointer-events-none"
        style={{
          border: `2px solid ${color}`,
          clipPath: holding ? "inset(0 0 0 0)" : "inset(100% 0 0 0)",
          opacity: holding ? 1 : 0,
          transition: holding ? `clip-path ${HOLD_MS}ms linear, opacity 80ms` : "opacity 120ms",
        }}
      />
      +
    </button>
  );
}
