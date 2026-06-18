"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  /** Hide the cancel button — turns the dialog into an acknowledge-only alert. */
  hideCancel?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    setVisible(false);
    // Flip to visible on the next frame so the slide-in transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setVisible(false);
    // Keep content mounted briefly so the exit transition can play
    setTimeout(() => setOpts(null), 200);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 transition-opacity duration-200"
            style={{ opacity: visible ? 1 : 0 }}
            onClick={() => close(false)}
          />
          {/* Sheet */}
          <div
            className="relative w-full max-w-md bg-[--surface] rounded-t-3xl px-5 pt-5 transition-transform duration-200 ease-out"
            style={{
              transform: visible ? "translateY(0)" : "translateY(100%)",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
            }}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[--border]" />
            <h2 className="font-[family-name:var(--font-instrument-serif)] italic text-[22px] text-[--foreground] leading-tight">
              {opts.title}
            </h2>
            {opts.message && (
              <p className="text-[14px] text-[--muted] mt-2 leading-relaxed">{opts.message}</p>
            )}
            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={() => close(true)}
                className="w-full py-3.5 rounded-2xl text-[15px] font-semibold active:scale-95 transition-transform"
                style={{
                  background: opts.destructive ? "#C0392B" : "var(--primary)",
                  color: "#fff",
                }}
              >
                {opts.confirmText ?? (opts.destructive ? "Delete" : "Confirm")}
              </button>
              {!opts.hideCancel && (
                <button
                  onClick={() => close(false)}
                  className="w-full py-3.5 rounded-2xl text-[15px] font-medium text-[--muted] border border-[--border] active:scale-95 transition-transform"
                >
                  {opts.cancelText ?? "Cancel"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
