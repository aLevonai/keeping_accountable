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
