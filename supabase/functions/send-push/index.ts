import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clamp(v: unknown, max: number): string {
  return String(v ?? "").slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidEmail = Deno.env.get("VAPID_EMAIL")!;

    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey);

    const admin = createClient(supabaseUrl, serviceKey);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { target_user_id: bodyTarget, title, body } = await req.json();

    let targetUserId: string | null = null;

    if (token && token === serviceKey) {
      // Trusted internal caller (the send-reminders cron). It runs as
      // service-role and may target any user (the goal owner to remind).
      targetUserId = bodyTarget ?? null;
      if (!targetUserId) return json({ error: "target_user_id required" }, 400);
    } else {
      // User-initiated call (check-in notification / nudge). Validate the JWT and
      // derive the recipient server-side — the only allowed target is the
      // caller's partner. Any client-supplied target_user_id is ignored.
      const {
        data: { user },
      } = await admin.auth.getUser(token);
      if (!user) return json({ error: "unauthorized" }, 401);

      const { data: membership } = await admin
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", user.id)
        .single();
      if (!membership) return json({ ok: true, sent: false, reason: "no_couple" });

      const { data: partner } = await admin
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", membership.couple_id)
        .neq("user_id", user.id)
        .single();
      if (!partner) return json({ ok: true, sent: false, reason: "no_partner" });

      targetUserId = partner.user_id;
    }

    const { data: targetUser } = await admin
      .from("users")
      .select("push_token")
      .eq("id", targetUserId)
      .single();

    if (!targetUser?.push_token) {
      return json({ ok: true, sent: false, reason: "no_token" });
    }

    const subscription = JSON.parse(targetUser.push_token);
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: clamp(title, 100), body: clamp(body, 300) })
    );

    return json({ ok: true, sent: true });
  } catch (err) {
    console.error("send-push error:", err);
    return json({ error: String(err) }, 500);
  }
});
