"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Small shared pieces of the Linen design system.

export function getInitial(name: string | null | undefined, fallback = "?"): string {
  return name?.trim().charAt(0).toUpperCase() || fallback;
}

export function firstName(name: string | null | undefined, fallback: string): string {
  return name?.trim().split(" ")[0] || fallback;
}

export function SectionDivider({ label, count, className = "mt-5 mb-2.5" }: { label: string; count?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted whitespace-nowrap">{label}</span>
      {count != null && (
        <span className="text-[9px] font-semibold text-muted bg-border rounded-full px-1.5 py-px">{count}</span>
      )}
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export function Dots({ count, target, color, size = 6 }: { count: number; target: number; color: string; size?: number }) {
  const max = Math.min(target, 8);
  return (
    <div className="flex gap-[3px] items-center" aria-label={`${count} of ${target}`}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: i < count ? color : "transparent",
            border: `1.5px solid ${i < count ? color : "var(--border)"}`,
            flexShrink: 0,
            transition: "background 200ms ease-out, border-color 200ms ease-out",
          }}
        />
      ))}
      {(target > 8 || count > target) && (
        <span style={{ color, fontSize: 10, marginLeft: 2 }}>{count}/{target}</span>
      )}
    </div>
  );
}

// Initial badge. "self" is tinted with the given color (goal color or
// primary), "partner" always uses the partner accent.
export function Avatar({
  name,
  who,
  size = 18,
  color = "var(--primary)",
}: {
  name: string | null | undefined;
  who: "self" | "partner";
  size?: number;
  color?: string;
}) {
  const style =
    who === "partner"
      ? { background: "var(--partner-light)", color: "var(--partner-accent)", border: "1px solid color-mix(in srgb, var(--partner-accent) 40%, transparent)" }
      : { background: `color-mix(in srgb, ${color} 14%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` };
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.45)), ...style }}
      aria-hidden
    >
      {getInitial(name, who === "self" ? "Y" : "P")}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 disabled:opacity-50 ${checked ? "bg-success" : "bg-[#B8AFA7]"}`}
    >
      <span
        className={`absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
      />
    </button>
  );
}

export function BackButton({ fallback = "/home", className = "mb-6" }: { fallback?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        // Deep links (notification taps) have no history to go back to.
        if (window.history.length > 1) router.back();
        else router.replace(fallback);
      }}
      className={`flex items-center gap-1 text-[14px] text-muted active:scale-95 transition-transform ${className}`}
    >
      <ArrowLeft size={16} />
      Back
    </button>
  );
}

export function PageTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={`font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-foreground leading-tight ${className}`}>
      {children}
    </h1>
  );
}
