"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// Saves this device's subscription. Each device gets its own row, so pushes
// reach every phone/laptop a person has installed the app on. Falls back to
// the legacy single users.push_token column if the new table isn't there yet.
async function saveSubscription(userId: string, sub: PushSubscription) {
  const supabase = createClient();
  const json = sub.toJSON();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: sub.endpoint, subscription: json }, { onConflict: "endpoint" });
  if (error) {
    await supabase.from("users").update({ push_token: JSON.stringify(json) }).eq("id", userId);
  }
}

async function deleteSubscription(userId: string, endpoint: string) {
  const supabase = createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  await supabase.from("users").update({ push_token: null }).eq("id", userId);
}

const noopSubscribe = () => () => {};

export function usePush() {
  const { user } = useAuth();
  // false during server render / hydration, then the real value.
  const supported = useSyncExternalStore(noopSubscribe, pushSupported, () => false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [denied, setPermissionDenied] = useState(false);
  const permissionDenied = denied || (supported && Notification.permission === "denied");

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      setSubscribed(!!sub);
      // Keep the server copy fresh (subscriptions can rotate).
      if (sub && user) void saveSubscription(user.id, sub);
    });
    return () => { cancelled = true; };
  }, [supported, user]);

  async function subscribe() {
    if (!user || !VAPID_PUBLIC_KEY) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      await saveSubscription(user.id, sub);
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    if (!user) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deleteSubscription(user.id, sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return { supported, subscribed, loading, permissionDenied, subscribe, unsubscribe };
}
