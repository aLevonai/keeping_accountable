import { createClient } from "@/lib/supabase/client";

// Lazy singleton — avoids constructing a fresh Supabase client on every call
// (the old getPhotoUrl built one per photo per render), while staying SSR-safe
// (createBrowserClient is only instantiated when a helper is actually invoked).
let _client: ReturnType<typeof createClient> | null = null;
function client() {
  if (!_client) _client = createClient();
  return _client;
}

const SIGNED_URL_TTL = 60 * 60; // 1 hour

// Derives the thumbnail storage path from the full-size path.
// e.g. completions/x/y/z/1234567.jpg → completions/x/y/z/1234567_thumb.jpg
export function thumbPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1
    ? path + "_thumb.jpg"
    : path.slice(0, dot) + "_thumb.jpg";
}

export async function uploadPhoto(
  file: File | Blob,
  coupleId: string,
  userId: string,
  completionId: string,
  thumbnail?: Blob
): Promise<string> {
  const name = file instanceof File ? file.name : "photo.jpg";
  const ext = name.split(".").pop() ?? "jpg";
  const path = `completions/${coupleId}/${userId}/${completionId}/${Date.now()}.${ext}`;

  const uploads: Promise<unknown>[] = [
    client().storage.from("media").upload(path, file, { upsert: false }),
  ];
  if (thumbnail) {
    uploads.push(
      client().storage.from("media").upload(thumbPath(path), thumbnail, { upsert: false })
    );
  }

  const [{ error }] = await Promise.all(uploads) as [{ error: unknown }, ...unknown[]];
  if (error) throw error;
  return path;
}

// The media bucket is private; reads require a short-lived signed URL scoped by
// the storage RLS policy (caller must be a member of the path's couple).
export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await client()
    .storage.from("media")
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

// Batch variant — one round-trip for a whole page of photos (e.g. the journal).
// Returns a map keyed by storage_path so callers can look up by path.
export async function getSignedPhotoUrls(
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await client()
    .storage.from("media")
    .createSignedUrls(paths, SIGNED_URL_TTL);
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

// Journal variant — fetches thumbnail AND full signed URLs in a single batch call.
// Thumbnails are small (600px, ~30–60 KB) and used by the journal grid.
// Full URLs are returned as fallback for photos uploaded before thumbnails were generated.
// Both maps are keyed by the original storage_path from the DB.
export async function getSignedPhotoUrlsWithThumbs(
  paths: string[]
): Promise<{ thumbs: Record<string, string>; fulls: Record<string, string> }> {
  if (paths.length === 0) return { thumbs: {}, fulls: {} };

  // Request [thumb1, thumb2, ..., full1, full2, ...] in one batch call.
  const allPaths = [...paths.map(thumbPath), ...paths];
  const { data } = await client()
    .storage.from("media")
    .createSignedUrls(allPaths, SIGNED_URL_TTL);

  const items = data ?? [];
  const thumbs: Record<string, string> = {};
  const fulls: Record<string, string> = {};

  for (let i = 0; i < paths.length; i++) {
    if (items[i]?.signedUrl) thumbs[paths[i]] = items[i].signedUrl!;
    if (items[paths.length + i]?.signedUrl) fulls[paths[i]] = items[paths.length + i].signedUrl!;
  }

  return { thumbs, fulls };
}
