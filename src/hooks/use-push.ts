"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePush() {
  const { user } = useAuth();
  const supabase = createClient();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(ok);
    if (!ok) return;

    if (Notification.permission === "denied") setPermissionDenied(true);

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    });
  }, []);

  async function subscribe() {
    if (!user || !VAPID_PUBLIC_KEY) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }
      setPermissionDenied(false);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      await supabase
        .from("users")
        .update({ push_token: JSON.stringify(sub) })
        .eq("id", user.id);
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
      await sub?.unsubscribe();
      await supabase
        .from("users")
        .update({ push_token: null })
        .eq("id", user.id);
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return { supported, subscribed, loading, permissionDenied, subscribe, unsubscribe };
}
