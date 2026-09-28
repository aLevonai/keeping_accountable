"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppData } from "@/contexts/app-data";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

// Bottom-nav order — swiping moves between neighbours.
export const TABS = ["/home", "/goals", "/dreams", "/journal", "/profile"] as const;

const DISTANCE = 70; // px of horizontal travel that commits a swipe
const FLICK_DISTANCE = 30; // …or less, if the finger was moving fast
const FLICK_SPEED = 0.35; // px/ms

// True if the touch started inside something that scrolls sideways (e.g. the
// shared-dreams carousel) or opted out, which should keep the gesture.
function ownsHorizontalGesture(target: Element, root: Element): boolean {
  if (target.closest("[data-no-swipe], input, textarea, select")) return true;
  for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
    const { overflowX } = getComputedStyle(node);
    if ((overflowX === "auto" || overflowX === "scroll") && node.scrollWidth > node.clientWidth) return true;
  }
  return false;
}

// Pull-to-refresh refetches every query on screen; a sideways swipe on any of
// the five tab pages moves to the neighbouring tab.
export function AppShell({ children }: { children: React.ReactNode }) {
  const { refetch } = useAppData();
  const pathname = usePathname();
  const router = useRouter();
  const surface = useRef<HTMLDivElement>(null);
  const [entering, setEntering] = useState<{ path: string; from: "left" | "right" } | null>(null);
  const tabIndex = (TABS as readonly string[]).indexOf(pathname);

  useEffect(() => {
    const el = surface.current;
    if (!el || tabIndex < 0) return;

    let start: { x: number; y: number; t: number } | null = null;
    let axis: "x" | "y" | null = null;

    const reset = (animate: boolean) => {
      el.style.transition = animate ? "transform 200ms ease-out" : "";
      el.style.transform = "";
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const blocked =
        e.touches.length !== 1 ||
        ownsHorizontalGesture(e.target as Element, el) ||
        // Leave the screen edges to the OS (back/forward gestures in Safari).
        t.clientX < 16 ||
        t.clientX > window.innerWidth - 16;
      start = blocked ? null : { x: t.clientX, y: t.clientY, t: Date.now() };
      axis = null;
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (!axis && Math.hypot(dx, dy) > 10) axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
      if (axis !== "x") return;
      // No neighbour in that direction → rubber-band harder.
      const edge = (dx > 0 && tabIndex === 0) || (dx < 0 && tabIndex === TABS.length - 1);
      el.style.transition = "none";
      el.style.transform = `translateX(${dx * (edge ? 0.08 : 0.25)}px)`;
    };

    const onEnd = (e: TouchEvent) => {
      if (!start || axis !== "x") {
        start = null;
        return;
      }
      const dx = e.changedTouches[0].clientX - start.x;
      const speed = Math.abs(dx) / Math.max(1, Date.now() - start.t);
      start = null;
      const committed = Math.abs(dx) > DISTANCE || (speed > FLICK_SPEED && Math.abs(dx) > FLICK_DISTANCE);
      const next = tabIndex + (dx < 0 ? 1 : -1);
      if (committed && next >= 0 && next < TABS.length) {
        reset(false);
        setEntering({ path: TABS[next], from: dx < 0 ? "right" : "left" });
        router.push(TABS[next]);
      } else {
        reset(true);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      reset(false);
    };
  }, [tabIndex, router]);

  const slide =
    entering?.path === pathname ? (entering.from === "right" ? "animate-tab-from-right" : "animate-tab-from-left") : "";

  return (
    // min-h-screen: short pages (Dreams, Profile) still swipe anywhere on screen.
    <div ref={surface} className="min-h-screen">
      <PullToRefresh onRefresh={refetch}>
        <div key={pathname} className={slide}>
          {children}
        </div>
      </PullToRefresh>
    </div>
  );
}
