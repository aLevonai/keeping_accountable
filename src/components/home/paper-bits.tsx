"use client";

import { seeded, between } from "@/utils/seeded";

// Hand-drawn pieces for the Home scrapbook: tally marks, a wobbly checkbox,
// and a torn paper edge.

/** Tally marks in groups of five (four strokes + a slash), drawn in ink. */
export function Tally({ count, color, max = 20 }: { count: number; color: string; max?: number }) {
  const shown = Math.min(count, max);
  const groups = Math.ceil(shown / 5);
  if (count === 0) {
    return <span className="font-hand text-[18px] text-muted leading-none">not yet</span>;
  }
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1" aria-label={`${count} check-ins`}>
      {Array.from({ length: groups }).map((_, g) => {
        const inGroup = Math.min(5, shown - g * 5);
        const r = seeded(`tally-${g}`);
        return (
          <svg key={g} width="30" height="24" viewBox="0 0 30 24" fill="none" aria-hidden>
            {Array.from({ length: Math.min(inGroup, 4) }).map((_, i) => {
              const x = 4 + i * 6 + between(r, -0.8, 0.8);
              return (
                <path
                  key={i}
                  d={`M${x} ${3 + between(r, -1, 1)} Q ${x + between(r, -1.2, 1.2)} 12 ${x + between(r, -0.8, 0.8)} ${21 + between(r, -1, 1)}`}
                  stroke={color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              );
            })}
            {inGroup === 5 && (
              <path d="M1 17 Q 14 10 28 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
            )}
          </svg>
        );
      })}
      {count > max && <span className="font-hand text-[18px] leading-none" style={{ color }}>+{count - max}</span>}
    </div>
  );
}

/** A wobbly pen-drawn checkbox; the check overshoots the box like a real tick. */
export function HandCheckbox({ checked, size = 24 }: { checked: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden className="overflow-visible">
      <path
        d="M4 5 C 9 4, 15 4.6, 21 4 C 21.6 10, 22 16, 21 22 C 15 22.6, 9 21.6, 4.6 22 C 4 16, 4.5 10, 4 5 Z"
        stroke="#6E6053"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill={checked ? "rgba(90,138,106,0.08)" : "none"}
      />
      {checked && (
        <path
          d="M7 13.5 C 9 15.5, 10.5 17.5, 11.5 19 C 14.5 12, 18.5 6.5, 25 1"
          stroke="var(--success)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** clip-path for a torn bottom edge, stable per seed. */
export function tornBottom(seed: string, teeth = 22): string {
  const r = seeded(seed);
  const pts = ["0 0", "100% 0"];
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * 100;
    const y = 100 - (i % 2 === 0 ? between(r, 0, 1.2) : between(r, 2.2, 4.2));
    pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${pts.join(", ")})`;
}

/** Wavy underline for handwritten headings. */
export function Squiggle({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 140 10" className={className} preserveAspectRatio="none">
      <path
        d="M2 6 C 20 1, 40 9, 60 5 S 100 2, 138 6"
        stroke="var(--primary)"
        strokeOpacity="0.55"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
