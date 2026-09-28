import type { NextConfig } from "next";

// The service worker (push + photo/static caching) is hand-written in
// public/sw.js and registered from components/providers.tsx.
const nextConfig: NextConfig = {
  experimental: {
    // App pages are static client shells (data comes from the query cache),
    // so a prefetched page never goes stale in a way that matters. The default
    // (5 min) meant reopening the PWA after a while made the next tab tap wait
    // on the server again. A new deploy still invalidates everything.
    staleTimes: { static: 60 * 60 * 24 },
  },
};

export default nextConfig;
