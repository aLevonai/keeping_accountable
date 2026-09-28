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

// Only in-app paths — never let a caller point a notification off-site.
function safePath(v: unknown): string {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s.slice(0, 300) : "/home";
}

interface Target {
  endpoint: string;
  subscription: webpush.PushSubscription;
  // Where it came from, so a dead subscription can be removed.
  source: { table: "push_subscriptions"; id: string } | { table: "users"; id: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    webpush.setVapidDetails(
      `mailto:${Deno.env.get("VAPID_EMAIL")!}`,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );
    const admin = createClient(supabaseUrl, serviceKey);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { target_user_id: bodyTarget, title, body, url, tag } = await req.json();

    let targetUserId: string | null = null;

    if (token && token === serviceKey) {
      // Trusted internal caller (the send-reminders cron) may target any user.
      targetUserId = bodyTarget ?? null;
      if (!targetUserId) return json({ error: "target_user_id required" }, 400);
    } else {
      // User-initiated (check-in notification / nudge / dream). The only
      // allowed recipient is the caller's partner, derived server-side; any
      // client-supplied target_user_id is ignored.
      const { data: { user } } = await admin.auth.getUser(token);
      if (!user) return json({ error: "unauthorized" }, 401);

      const { data: membership } = await admin
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", user.id)
        .single();
      if (!membership) return json({ ok: true, sent: 0, reason: "no_couple" });

      const { data: partner } = await admin
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", membership.couple_id)
        .neq("user_id", user.id)
        .maybeSingle();
      if (!partner) return json({ ok: true, sent: 0, reason: "no_partner" });

      targetUserId = partner.user_id;
    }

    // Every device the recipient has subscribed, plus the legacy single token.
    const targets: Target[] = [];
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, subscription")
      .eq("user_id", targetUserId);
    for (const s of subs ?? []) {
      targets.push({ endpoint: s.endpoint, subscription: s.subscription, source: { table: "push_subscriptions", id: s.id } });
    }
    const { data: targetUser } = await admin.from("users").select("push_token").eq("id", targetUserId).single();
    if (targetUser?.push_token) {
      try {
        const legacy = JSON.parse(targetUser.push_token) as webpush.PushSubscription;
        if (legacy.endpoint && !targets.some((t) => t.endpoint === legacy.endpoint)) {
          targets.push({ endpoint: legacy.endpoint, subscription: legacy, source: { table: "users", id: targetUserId! } });
        }
      } catch {
        // malformed legacy token — ignore
      }
    }

    if (targets.length === 0) return json({ ok: true, sent: 0, reason: "no_token" });

    const payload = JSON.stringify({
      title: clamp(title, 100),
      body: clamp(body, 300),
      url: safePath(url),
      tag: tag ? clamp(tag, 64) : undefined,
    });

    let sent = 0;
    await Promise.all(
      targets.map(async (t) => {
        try {
          await webpush.sendNotification(t.subscription, payload);
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404/410: the subscription is gone (app removed, permission revoked).
          if (status === 404 || status === 410) {
            if (t.source.table === "push_subscriptions") {
              await admin.from("push_subscriptions").delete().eq("id", t.source.id);
            } else {
              await admin.from("users").update({ push_token: null }).eq("id", t.source.id);
            }
          } else {
            console.error("send-push delivery error:", status, err);
          }
        }
      })
    );

    return json({ ok: true, sent });
  } catch (err) {
    console.error("send-push error:", err);
    return json({ error: String(err) }, 500);
  }
});
