"use client";

import { pick, between } from "@/utils/seeded";

// Shared scrapbook materials (washi tape, paper clips, sticky-note and ink
// colours) used by the Journal and Home.

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
