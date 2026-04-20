import { createClient } from "@/lib/supabase/client";

export async function uploadPhoto(
  file: File,
  coupleId: string,
  userId: string,
  completionId: string
): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `completions/${coupleId}/${userId}/${completionId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, { upsert: false });

  if (error) throw error;
  return path;
}

export function getPhotoUrl(path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}
