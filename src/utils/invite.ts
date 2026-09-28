// Shared invite-code helpers (used by onboard + profile).
// Wider keyspace than the old 8×9000 (~72k, enumerable in minutes): 12 words ×
// 6 crypto-random digits ≈ 10.8M, and codes now actually expire after 7 days
// and are single-use — so a leaked/guessed code is no longer a permanent token.

const WORDS = [
  "ROSE", "MOON", "LOVE", "STAR", "BLOOM", "SOUL",
  "BOND", "GLOW", "DAWN", "FERN", "TIDE", "LUMEN",
];

function randInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Math.floor((buf[0] / 2 ** 32) * max);
}

export function generateInviteCode(): string {
  const word = WORDS[randInt(WORDS.length)];
  const num = 100000 + randInt(900000); // 6 digits
  return `${word}-${num}`;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function inviteExpiry(): string {
  return new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/join/${encodeURIComponent(code)}`;
}

// Opens the native share sheet (iMessage, WhatsApp…) with a join link; falls
// back to copying it. Returns "copied" when it fell back to the clipboard.
export async function shareInvite(code: string): Promise<"shared" | "copied" | "cancelled"> {
  const url = inviteLink(code);
  const text = `Join me on CheckMate — tap the link, or enter code ${code}`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "CheckMate", text, url });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "cancelled";
    }
  }
  await navigator.clipboard?.writeText(`${text}\n${url}`).catch(() => {});
  return "copied";
}

// A code from a /join link, remembered across the sign-in round-trip.
const PENDING_KEY = "checkmate-pending-invite";
export function rememberPendingInvite(code: string) {
  try { localStorage.setItem(PENDING_KEY, code); } catch { /* ignore */ }
}
export function takePendingInvite(): string | null {
  try {
    const code = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    return code;
  } catch {
    return null;
  }
}
export function peekPendingInvite(): string | null {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
}
