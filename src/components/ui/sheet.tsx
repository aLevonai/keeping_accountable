"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Bottom sheet — the in-app replacement for window.confirm/alert, which in an
// installed iOS PWA render as system dialogs showing the site URL.
export function Sheet({
  open,
  onClose,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  // Keep mounted through the exit animation.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const hide = requestAnimationFrame(() => setVisible(false));
    const t = setTimeout(() => setMounted(false), 240);
    return () => { cancelAnimationFrame(hide); clearTimeout(t); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={label}>
      <div
        className="absolute inset-0 bg-black/35 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-[22px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-[240ms] ease-out max-h-[92vh] overflow-y-auto"
        style={{
          transform: visible ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
