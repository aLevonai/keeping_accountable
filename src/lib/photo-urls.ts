"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createSignedUrls } from "@/utils/storage";

// Signed-URL cache for private photos.
//
// Every createSignedUrl call returns a different URL (the token is in the query
// string), so re-signing on every page load defeated the browser cache and
// re-downloaded every photo. Here each path keeps one URL until it nears
// expiry, persisted across launches, and requests are batched into a single
// round-trip per frame. The service worker additionally caches photos by path
// (ignoring the token), so even a stale URL renders instantly from cache.

interface Entry { url: string; exp: number }

const STORAGE_KEY = "checkmate-photo-urls";
const REFRESH_MARGIN = 5 * 60 * 1000;

let cache: Record<string, Entry> | null = null;
let version = 0;
const listeners = new Set<() => void>();
const pending = new Set<string>();
const inflight = new Set<string>();
let flushScheduled = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function getCache(): Record<string, Entry> {
  if (cache) return cache;
  cache = {};
  if (typeof window === "undefined") return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, Entry>;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [k, v] of Object.entries(raw)) if (v.exp > cutoff) cache[k] = v;
  } catch {
    // corrupt — start fresh
  }
  return cache;
}

function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(getCache())); } catch { /* quota */ }
  }, 500);
}

function notify() {
  version++;
  listeners.forEach((l) => l());
}

function isFresh(e: Entry | undefined): boolean {
  return !!e && e.exp - Date.now() > REFRESH_MARGIN;
}

async function flush() {
  flushScheduled = false;
  const batch = [...pending].slice(0, 200);
  batch.forEach((p) => { pending.delete(p); inflight.add(p); });
  if (batch.length === 0) return;
  try {
    const exp = Date.now() + 55 * 60 * 1000; // TTL is 1h; refresh a little early
    const results = await createSignedUrls(batch);
    const c = getCache();
    for (const { path, url } of results) if (url) c[path] = { url, exp };
    persist();
    notify();
  } catch {
    // leave entries as-is; the next render will retry
  } finally {
    batch.forEach((p) => inflight.delete(p));
    if (pending.size > 0) scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  // Collect every image rendered in this frame into one request.
  setTimeout(flush, 16);
}

export function requestSignedUrl(path: string, force = false) {
  if (inflight.has(path) || pending.has(path)) return;
  if (!force && isFresh(getCache()[path])) return;
  if (force) delete getCache()[path];
  pending.add(path);
  scheduleFlush();
}

export function prefetchSignedUrls(paths: string[]) {
  paths.forEach((p) => requestSignedUrl(p));
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Returns the best-known URL for a storage path (possibly stale) and keeps it fresh. */
export function useSignedUrl(path: string | null | undefined): string | undefined {
  useSyncExternalStore(subscribe, () => version, () => 0);
  const entry = path ? getCache()[path] : undefined;
  const fresh = isFresh(entry);
  useEffect(() => {
    if (path && !fresh) requestSignedUrl(path);
  }, [path, fresh]);
  return entry?.url;
}

export function clearPhotoUrlCache() {
  cache = {};
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  notify();
}
