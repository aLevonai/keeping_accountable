// CheckMate service worker: push notifications + caching for photos and the
// app's hashed static assets. Plain JS — served as-is from /sw.js.

const PHOTO_CACHE = "checkmate-photos-v1";
const STATIC_CACHE = "checkmate-static-v1";
const MAX_PHOTOS = 800;
const MAX_STATIC = 300;
// Registered as /sw.js?static=1 by production builds only.
const CACHE_STATIC = new URL(self.location.href).searchParams.get("static") === "1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PHOTO_CACHE, STATIC_CACHE];
      for (const key of await caches.keys()) {
        if (!keep.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

// ── Caching ──────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Private photos come from signed URLs whose token changes on every signing.
  // The object at a path never changes (upload paths are unique), so cache by
  // path and ignore the token.
  if (url.pathname.startsWith("/storage/v1/object/sign/media/")) {
    event.respondWith(photo(event, url));
    return;
  }

  // Content-hashed build assets are immutable.
  if (CACHE_STATIC && url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, STATIC_CACHE, MAX_STATIC));
  }
});

async function photo(event, url) {
  const req = event.request;
  const key = url.origin + url.pathname;
  const cache = await caches.open(PHOTO_CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  let res;
  try {
    // CORS fetch so we can see the status and never cache an error.
    res = await fetch(req.url, { mode: "cors", credentials: "omit" });
  } catch {
    return fetch(req);
  }
  if (res.ok) event.waitUntil(putAndTrim(cache, key, res.clone(), MAX_PHOTOS));
  return res;
}

async function cacheFirst(event, name, max) {
  const req = event.request;
  const cache = await caches.open(name);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) event.waitUntil(putAndTrim(cache, req.url, res.clone(), max));
  return res;
}

let putsSinceTrim = 0;
async function putAndTrim(cache, key, res, max) {
  try {
    await cache.put(key, res);
    if (++putsSinceTrim < 25) return;
    putsSinceTrim = 0;
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  } catch {
    // quota exceeded etc. — caching is best-effort
  }
}

// ── Push ─────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "CheckMate", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/home" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/home";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          // The app navigates client-side (no reload) when it gets this.
          client.postMessage({ type: "navigate", url: path });
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
