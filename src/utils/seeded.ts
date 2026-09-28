// Deterministic randomness keyed by an id: every journal entry gets its own
// tilt, tape and card style, and keeps them across renders and devices.

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Returns a PRNG (mulberry32) seeded from `id`; each call yields a float in [0, 1). */
export function seeded(id: string): () => number {
  let a = fnv1a(id);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)];
}

export function between(r: () => number, min: number, max: number): number {
  return min + r() * (max - min);
}
