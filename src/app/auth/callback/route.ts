import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Upsert user profile
      await supabase.from("users").upsert(
        {
          id: data.user.id,
          display_name: data.user.email?.split("@")[0] ?? "Friend",
        },
        { onConflict: "id", ignoreDuplicates: true }
      );

      // Check if user has a couple already
      const { data: member } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", data.user.id)
        .single();

      if (member) {
        return NextResponse.redirect(`${origin}/home`);
      } else {
        return NextResponse.redirect(`${origin}/onboard`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/welcome?error=auth_failed`);
}
