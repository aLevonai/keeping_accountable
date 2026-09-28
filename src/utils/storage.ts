import { createClient } from "@/lib/supabase/client";
import type { PreparedImage } from "@/utils/image";

const BUCKET = "media";
export const SIGNED_URL_TTL = 60 * 60; // 1 hour

// Derives the thumbnail storage path from the full-size path.
// e.g. completions/x/y/z/1234567.jpg → completions/x/y/z/1234567_thumb.jpg
export function thumbPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? path + "_thumb.jpg" : path.slice(0, dot) + "_thumb.jpg";
}

// Object paths are `<kind>/<coupleId>/<userId>/<entityId>/<ts>.jpg`; the
// storage RLS policy authorizes on the couple id (2nd segment).
export async function uploadPhoto(
  image: PreparedImage,
  kind: "completions" | "dreams",
  coupleId: string,
  userId: string,
  entityId: string
): Promise<string> {
  const path = `${kind}/${coupleId}/${userId}/${entityId}/${Date.now()}.jpg`;
  const storage = createClient().storage.from(BUCKET);
  // Paths are unique per upload, so the objects are immutable — let browsers
  // and the service worker cache them for a year.
  const opts = { upsert: false, cacheControl: "31536000", contentType: "image/jpeg" };
  const [full, thumb] = await Promise.all([
    storage.upload(path, image.full, opts),
    storage.upload(thumbPath(path), image.thumb, opts),
  ]);
  if (full.error) throw full.error;
  if (thumb.error) console.warn("Thumbnail upload failed:", thumb.error);
  return path;
}

// Removes photos and their thumbnails. Best-effort: a failure only leaks
// storage, it never blocks the user's action.
export async function removePhotos(paths: (string | null | undefined)[]): Promise<void> {
  const all = paths.filter((p): p is string => !!p).flatMap((p) => [p, thumbPath(p)]);
  if (all.length === 0) return;
  try {
    await createClient().storage.from(BUCKET).remove(all);
  } catch (err) {
    console.warn("Photo cleanup failed:", err);
  }
}

export async function createSignedUrls(paths: string[]): Promise<{ path: string; url: string | null }[]> {
  if (paths.length === 0) return [];
  const { data } = await createClient().storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  return paths.map((path, i) => ({ path, url: data?.[i]?.signedUrl ?? null }));
}

// Single URL — used by the thumbnail backfill.
export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await createClient().storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}
