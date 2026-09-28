"use client";

import { useSyncExternalStore } from "react";
import { Sheet } from "@/components/ui/sheet";
import { CelebrationHost } from "@/components/ui/celebrate";

// Tiny global stores so any code (mutations, background uploads) can raise a
// toast or ask for confirmation without threading context through props.

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: T) => { state = next; listeners.forEach((l) => l()); },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

// ── Toasts ────────────────────────────────────────────────────────────────

interface ToastState {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
  tone: "default" | "error";
}

const toastStore = createStore<ToastState | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastSeq = 0;

export function toast(
  message: string,
  opts: { action?: ToastState["action"]; tone?: ToastState["tone"]; duration?: number } = {}
) {
  const id = ++toastSeq;
  toastStore.set({ id, message, action: opts.action, tone: opts.tone ?? "default" });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toastStore.get()?.id === id) toastStore.set(null);
  }, opts.duration ?? (opts.action ? 5000 : 3000));
}

export function dismissToast() {
  toastStore.set(null);
}

function ToastHost() {
  const t = useSyncExternalStore(toastStore.subscribe, toastStore.get, () => null);
  return (
    <div
      className="fixed left-0 right-0 z-[90] flex justify-center px-4 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
      aria-live="polite"
    >
      {t && (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 max-w-[420px] w-full rounded-2xl px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)] animate-toast-in"
          style={{ background: t.tone === "error" ? "#7F2A1D" : "#2A231E", color: "#FBF7F3" }}
        >
          <p className="flex-1 text-[14px] leading-snug">{t.message}</p>
          {t.action && (
            <button
              onClick={() => { t.action!.onClick(); dismissToast(); }}
              className="text-[14px] font-semibold text-[#F2B89C] active:opacity-60 flex-shrink-0"
            >
              {t.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Confirm sheet ─────────────────────────────────────────────────────────

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
}

const confirmStore = createStore<ConfirmRequest | null>(null);

export function confirmSheet(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    confirmStore.get()?.resolve(false);
    confirmStore.set({
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? "Confirm",
      destructive: opts.destructive ?? false,
      resolve,
    });
  });
}

function ConfirmHost() {
  const req = useSyncExternalStore(confirmStore.subscribe, confirmStore.get, () => null);
  const close = (ok: boolean) => {
    req?.resolve(ok);
    confirmStore.set(null);
  };
  return (
    <Sheet open={!!req} onClose={() => close(false)} label={req?.title}>
      {req && (
        <div className="px-5 pt-2 pb-1 flex flex-col gap-4">
          <div>
            <p className="text-[17px] font-semibold text-foreground">{req.title}</p>
            {req.message && <p className="text-[14px] text-muted mt-1 leading-relaxed">{req.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => close(true)}
              className="w-full py-3.5 rounded-2xl text-[15px] font-semibold text-white active:scale-[0.98] transition-transform"
              style={{ background: req.destructive ? "#B83A26" : "var(--primary)" }}
            >
              {req.confirmLabel}
            </button>
            <button
              onClick={() => close(false)}
              className="w-full py-3.5 rounded-2xl text-[15px] font-medium text-foreground bg-surface-alt active:scale-[0.98] transition-transform"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function FeedbackHost() {
  return (
    <>
      <ToastHost />
      <ConfirmHost />
      <CelebrationHost />
    </>
  );
}
