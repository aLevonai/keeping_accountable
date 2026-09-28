"use client";

import { useId } from "react";
import { seeded, pick, between } from "@/utils/seeded";

// Shared scrapbook materials used across the app: washi tape, clips, pins,
// tally marks, hand-drawn checkboxes, punched-hole progress, ink stamps,
// postage stamps, postmarks, torn edges and handwritten headings.

export const WASHI = [
  { base: "rgba(240,190,150,0.78)", ink: "rgba(255,255,255,0.35)" }, // peach
  { base: "rgba(170,208,188,0.78)", ink: "rgba(255,255,255,0.35)" }, // mint
  { base: "rgba(200,190,228,0.75)", ink: "rgba(255,255,255,0.35)" }, // lavender
  { base: "rgba(244,222,140,0.75)", ink: "rgba(255,255,255,0.4)" },  // butter
  { base: "rgba(170,202,228,0.75)", ink: "rgba(255,255,255,0.35)" }, // sky
  { base: "rgba(236,178,184,0.75)", ink: "rgba(255,255,255,0.35)" }, // rose
] as const;

export const PATTERNS = ["plain", "stripes", "dots", "grid"] as const;

export function tapeBackground(color: (typeof WASHI)[number], pattern: (typeof PATTERNS)[number]): string {
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

export function Tape({ r, style }: { r: () => number; style: React.CSSProperties }) {
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

export function Tapes({ r }: { r: () => number }) {
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

export function PaperClip({ color = "#9AA3AB" }: { color?: string }) {
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

// ── Hand-drawn marks ──────────────────────────────────────────────────────

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

// ── Page furniture ────────────────────────────────────────────────────────

/** Paper-textured page that runs under the bottom nav. */
export function PaperPage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`paper-bg min-h-screen pb-40 -mb-24 ${className}`}>{children}</div>;
}

/** Tab page header: serif title, handwritten subtitle, optional action. */
export function PaperHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="px-5 pt-14 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[32px] leading-none text-foreground">{title}</h1>
        {subtitle && <p className="font-hand text-[20px] leading-tight text-muted mt-1.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 pt-1">{action}</div>}
    </header>
  );
}

/** Handwritten section heading with a squiggle and an optional count. */
export function HandHeading({ children, count, className = "mt-9 mb-3" }: { children: React.ReactNode; count?: number; className?: string }) {
  return (
    <div className={`flex items-end gap-2 px-6 ${className}`}>
      <div className="relative">
        <h2 className="font-hand text-[27px] leading-none text-[#3B332C]">{children}</h2>
        <Squiggle className="absolute -bottom-2 left-0 w-full h-2" />
      </div>
      {count != null && (
        <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-0.5">{count}</span>
      )}
    </div>
  );
}

/** Round push pin. */
export function Pin({ color = "var(--primary)", className = "" }: { color?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute z-[2] w-3 h-3 rounded-full ${className}`}
      style={{ background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${color} 55%, white), ${color} 70%)`, boxShadow: "0 2px 2px rgba(0,0,0,0.3)" }}
    />
  );
}

/**
 * Progress as holes punched in a card: filled with ink when done, otherwise an
 * empty hole showing the paper underneath. Falls back to a count past 10.
 */
export function Punches({ count, target, color }: { count: number; target: number; color: string }) {
  if (target > 10) {
    return (
      <span className="font-hand text-[19px] leading-none" style={{ color }}>
        {count} / {target}
      </span>
    );
  }
  return (
    <div className="flex gap-1.5 items-center" aria-label={`${count} of ${target}`}>
      {Array.from({ length: target }).map((_, i) => (
        <span
          key={i}
          className="block w-[13px] h-[13px] rounded-full"
          style={
            i < count
              ? { background: color, boxShadow: `inset 0 -1px 1px rgba(0,0,0,0.18), 0 0 0 1.5px color-mix(in srgb, ${color} 25%, transparent)` }
              : { background: "#EEE6DA", boxShadow: "inset 0 1.5px 2px rgba(60,40,20,0.35)" }
          }
        />
      ))}
      {count > target && <span className="font-hand text-[17px] leading-none ml-0.5" style={{ color }}>+{count - target}</span>}
    </div>
  );
}

/** Rubber-stamped label (DONE, streaks…). */
export function InkStamp({
  children,
  color = "var(--success)",
  rotate = -8,
  size = "sm",
  className = "",
}: {
  children: React.ReactNode;
  color?: string;
  rotate?: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const big = size === "lg";
  return (
    <span
      className={`inline-block font-mono font-bold uppercase leading-none rounded-[6px] ${big ? "text-[17px] tracking-[0.18em] px-3 py-1.5" : "text-[9px] tracking-[0.16em] px-1.5 py-1"} ${className}`}
      style={{
        color,
        border: `${big ? 2.5 : 1.5}px solid ${color}`,
        boxShadow: big ? `inset 0 0 0 2px #FBF7F1, inset 0 0 0 3px ${color}` : undefined,
        transform: `rotate(${rotate}deg)`,
        opacity: 0.85,
      }}
    >
      {children}
    </span>
  );
}

/** Perforated postage stamp. */
export function PostageStamp({ color, children, rotate = 4 }: { color: string; children?: React.ReactNode; rotate?: number }) {
  return (
    <div
      aria-hidden
      className="relative w-[46px] h-[54px] p-[4px]"
      style={{
        // Perforated edge: a white stamp with scalloped holes on every side.
        background: "radial-gradient(circle, transparent 2.2px, #FFFEFB 2.6px) -3px -3px / 7px 7px",
        filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.18))",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div
        className="w-full h-full flex items-center justify-center font-[family-name:var(--font-instrument-serif)] italic text-[20px] text-white"
        style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${color} 80%, white), ${color})` }}
      >
        {children ?? "✦"}
      </div>
    </div>
  );
}

/** Circular postmark cancel, e.g. over a stamp when a dream is achieved. */
export function Postmark({ label, date, color = "#6B4E3D", className = "" }: { label: string; date: string; color?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden width="92" height="92" viewBox="0 0 92 92" className={className} style={{ opacity: 0.8 }}>
      <circle cx="46" cy="46" r="40" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="46" cy="46" r="31" fill="none" stroke={color} strokeWidth="1.2" />
      <defs>
        <path id={`${id}-top`} d="M 14 46 A 32 32 0 0 1 78 46" />
        <path id={`${id}-bottom`} d="M 18 50 A 28 28 0 0 0 74 50" />
      </defs>
      <text fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="700" letterSpacing="2" fill={color}>
        <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">{label}</textPath>
      </text>
      <text fontFamily="ui-monospace, monospace" fontSize="8" letterSpacing="1.5" fill={color}>
        <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">CHECKMATE</textPath>
      </text>
      <text x="46" y="50" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9" fontWeight="700" fill={color}>
        {date}
      </text>
      {/* Wavy cancellation lines */}
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M 70 ${34 + i * 10} q 6 -4 12 0 t 12 0`} fill="none" stroke={color} strokeWidth="1.4" />
      ))}
    </svg>
  );
}

/** Lined notebook card with a red margin (used for lists and forms). */
export function NotebookCard({ children, className = "", tilt = 0.4 }: { children: React.ReactNode; className?: string; tilt?: number }) {
  return (
    <div
      className={`relative bg-[#FFFDF8] shadow-[0_2px_5px_rgba(60,40,20,0.1),0_14px_24px_-16px_rgba(60,40,20,0.35)] ${className}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </div>
  );
}
