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

export async function uploadPhoto(
  file: File | Blob,
  coupleId: string,
  userId: string,
  completionId: string
): Promise<string> {
  const name = file instanceof File ? file.name : "photo.jpg";
  const ext = name.split(".").pop() ?? "jpg";
  const path = `completions/${coupleId}/${userId}/${completionId}/${Date.now()}.${ext}`;

  const { error } = await client()
    .storage.from("media")
    .upload(path, file, { upsert: false });

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
