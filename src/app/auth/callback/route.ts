import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();
  let userId: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) userId = data.user.id;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email" | "recovery" | "invite",
    });
    if (!error && data.user) userId = data.user.id;
  }

  if (userId) {
    // Upsert user profile
    await supabase.from("users").upsert(
      { id: userId, display_name: (await supabase.auth.getUser()).data.user?.email?.split("@")[0] ?? "Friend" },
      { onConflict: "id", ignoreDuplicates: true }
    );

    // Check if user has a couple already
    const { data: member } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", userId)
      .single();

    return NextResponse.redirect(`${origin}${member ? "/home" : "/onboard"}`);
  }

  return NextResponse.redirect(`${origin}/welcome?error=auth_failed`);
}
