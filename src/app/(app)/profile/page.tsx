"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCouple } from "@/hooks/use-couple";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { couple, partner, self } = useCouple(user?.id);
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    if (self) setDisplayName(self.display_name);
  }, [self]);

  // Load active invite code if partner hasn't joined yet
  useEffect(() => {
    if (!couple || partner) return;
    supabase
      .from("couple_invites")
      .select("code")
      .eq("couple_id", couple.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setInviteCode(data?.code ?? null));
  }, [couple?.id, partner]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    await supabase
      .from("users")
      .update({ display_name: displayName.trim() })
      .eq("id", user.id);
    setSaving(false);
  }

  return (
    <div className="px-4 pt-12 pb-8 min-h-screen">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* Display name */}
      <form onSubmit={handleSaveName} className="mb-6">
        <label className="text-sm font-medium text-gray-700 block mb-1">Your name</label>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving || !displayName.trim()}
            className="px-3 py-2 bg-gray-900 text-white text-sm rounded disabled:opacity-40"
          >
            {saving ? "..." : "Save"}
          </button>
        </div>
      </form>

      {/* Couple info */}
      <div className="border border-gray-200 rounded p-3 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Couple</p>
        {partner ? (
          <p className="text-sm text-gray-900">
            You & <span className="font-medium">{partner.display_name}</span>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-500">Your partner hasn&apos;t joined yet.</p>
            {inviteCode && (
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
                <p className="text-xs text-gray-400 mb-0.5">Invite code</p>
                <p className="text-lg font-bold tracking-widest text-gray-900">{inviteCode}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account */}
      <div className="border border-gray-200 rounded p-3 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-1">Account</p>
        <p className="text-sm text-gray-500">{user?.email}</p>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="text-sm text-red-500 underline"
      >
        Sign out
      </button>
    </div>
  );
}
