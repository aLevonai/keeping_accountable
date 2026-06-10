"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 72; // px of pull needed to trigger refresh

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const active = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY === 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      active.current = true;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!active.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      // resist: pull feels heavier the further you go
      setPullDistance(Math.min(delta * 0.45, THRESHOLD + 16));
    } else {
      setPullDistance(0);
    }
  }

  async function onTouchEnd() {
    if (!active.current) return;
    active.current = false;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      await onRefresh();
      setRefreshing(false);
    }
    setPullDistance(0);
  }

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const indicatorHeight = refreshing ? THRESHOLD : pullDistance;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: indicatorHeight,
          transition: refreshing || pullDistance === 0 ? "height 0.2s ease" : "none",
        }}
      >
        <RefreshCw
          size={20}
          className="text-[--primary]"
          style={{
            opacity: progress,
            transform: `rotate(${progress * 270}deg)`,
            transition: refreshing ? "none" : "transform 0.05s linear",
            animation: refreshing ? "spin 0.8s linear infinite" : "none",
          }}
        />
      </div>

      {children}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
