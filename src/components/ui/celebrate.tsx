"use client";

import { useSyncExternalStore } from "react";

// A short confetti burst for big moments (achieving a dream). Pure CSS.

let burst = 0;
const listeners = new Set<() => void>();

export function celebrate() {
  burst++;
  listeners.forEach((l) => l());
}

const COLORS = ["#C4704F", "#E8B04A", "#4A7A9B", "#5A8A6A", "#E59A7F", "#F2D0A4"];

export function CelebrationHost() {
  const id = useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => burst,
    () => 0
  );
  if (id === 0) return null;
  return (
    <div key={id} className="fixed inset-0 z-[95] pointer-events-none overflow-hidden" aria-hidden>
      {Array.from({ length: 36 }).map((_, i) => {
        // Deterministic spread per piece.
        const angle = (i / 36) * Math.PI * 2 + (i % 3) * 0.2;
        const dist = 120 + ((i * 37) % 140);
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 80;
        const rot = ((i * 53) % 360) - 180;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-[42%] block animate-confetti"
            style={{
              width: i % 4 === 0 ? 6 : 8,
              height: i % 4 === 0 ? 6 : 12,
              borderRadius: i % 4 === 0 ? "50%" : 2,
              background: COLORS[i % COLORS.length],
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
              ["--rot" as string]: `${rot}deg`,
              animationDelay: `${(i % 6) * 18}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
