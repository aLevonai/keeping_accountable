"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/contexts/app-data";
import { usePush } from "@/hooks/use-push";
import { ChevronRight } from "lucide-react";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { couple, partner, self } = useAppData();
  const { supported, subscribed, loading: pushLoading, permissionDenied, subscribe, unsubscribe } = usePush();
  const supabase = createClient();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);

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

  async function handleRegenerateCode() {
    if (!couple || !user) return;
    setRegenerating(true);
    // Expire all existing codes
    await supabase
      .from("couple_invites")
      .update({ expires_at: new Date().toISOString() })
      .eq("couple_id", couple.id)
      .is("accepted_at", null);
    // Generate new one
    const words = ["ROSE", "MOON", "LOVE", "STAR", "BLOOM", "SOUL", "BOND", "GLOW"];
    const word = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    const newCode = `${word}-${num}`;
    await supabase.from("couple_invites").insert({
      couple_id: couple.id,
      inviter_id: user.id,
      code: newCode,
      expires_at: "2099-01-01T00:00:00Z",
    });
    setInviteCode(newCode);
    setRegenerating(false);
  }

  async function handleLeaveCouple() {
    if (!couple || !user) return;
    if (!confirm("Are you sure you want to leave this couple? This cannot be undone.")) return;
    setLeaving(true);
    await supabase
      .from("couple_members")
      .delete()
      .eq("couple_id", couple.id)
      .eq("user_id", user.id);
    router.push("/onboard");
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    await supabase
      .from("users")
      .update({ display_name: displayName.trim() })
      .eq("id", user.id);
    setSaving(false);
    setEditingName(false);
  }

  async function handleCopyCode() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selfName = self?.display_name ?? "You";
  const partnerName = partner?.display_name ?? "Partner";

  return (
    <div className="px-5 pt-14 pb-8 min-h-screen bg-[--background]">
      {/* Header */}
      <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[26px] text-[--foreground] mb-6">Profile</h1>

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="w-[72px] h-[72px] rounded-full bg-[--primary-light] flex items-center justify-center">
          <span className="text-[24px] font-semibold text-[--primary]">{getInitials(selfName)}</span>
        </div>
        <p className="text-[17px] font-semibold text-[--foreground]">{selfName}</p>
        <p className="text-[13px] text-[--muted]">{user?.email}</p>
      </div>

      {/* Partner card */}
      <div className="bg-[--surface] rounded-2xl border border-[--border] mb-4 overflow-hidden">
        {partner ? (
          <>
            {/* Partner connected */}
            <div className="px-4 py-3.5 flex items-center gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[--muted] mb-1">Partner</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-[--primary-light] flex items-center justify-center flex-shrink-0">
                    <span className="text-[14px] font-semibold text-[--primary]">{getInitials(partnerName)}</span>
                  </div>
                  <div>
                    <p className="text-[15px] font-medium text-[--foreground]">{partnerName}</p>
                    <p className="text-[12px] text-[--success]">Connected</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* No partner yet — show invite code */}
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[--muted] mb-2">Partner</p>
              <p className="text-[14px] text-[--muted]">Your partner hasn&apos;t joined yet.</p>
            </div>
            {inviteCode && (
              <>
                <div className="h-px bg-[--border]" />
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[--muted] mb-1">Invite Code</p>
                    <p className="text-[18px] font-semibold tracking-[0.12em] text-[--foreground]">{inviteCode}</p>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="bg-[--primary-light] text-[--primary] text-[11px] font-semibold rounded-md px-2 py-1 active:scale-95 transition-transform"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </>
            )}
            <div className="h-px bg-[--border]" />
            <button
              onClick={handleRegenerateCode}
              disabled={regenerating}
              className="w-full px-4 py-3 text-[14px] text-[--muted] text-left disabled:opacity-40"
            >
              {regenerating ? "Generating..." : "Get a new code"}
            </button>
          </>
        )}
      </div>

      {/* Settings card */}
      <div className="bg-[--surface] rounded-2xl border border-[--border] mb-4 overflow-hidden">
        {/* Edit display name */}
        {editingName ? (
          <form onSubmit={handleSaveName} className="px-4 py-3.5">
            <p className="text-[13px] font-medium text-[--foreground] mb-2">Edit display name</p>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-[--border] rounded-xl px-3 py-2 text-[14px] bg-[--surface] text-[--foreground] focus:outline-none focus:border-[--primary] focus:ring-1 focus:ring-[--primary] transition-colors"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                disabled={saving || !displayName.trim()}
                className="px-3 py-2 bg-[--primary] text-[--foreground] text-[13px] font-medium rounded-xl disabled:opacity-40"
              >
                {saving ? "..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setEditingName(false); if (self) setDisplayName(self.display_name); }}
                className="px-3 py-2 border border-[--border] text-[--muted] text-[13px] rounded-xl"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 active:bg-[--surface-alt] transition-colors"
          >
            <span className="text-[15px] text-[--foreground]">Edit display name</span>
            <ChevronRight size={16} className="text-[--muted]" />
          </button>
        )}

        {/* Notifications */}
        {supported && (
          <>
            <div className="h-px bg-[--border]" />
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-[15px] text-[--foreground]">Notifications</p>
                {permissionDenied ? (
                  <p className="text-[11px] text-[#C0392B] mt-0.5">
                    Blocked. Allow in browser settings.
                  </p>
                ) : (
                  <p className="text-[11px] text-[--muted] mt-0.5">
                    {subscribed ? "Enabled" : "Get notified when your partner checks in"}
                  </p>
                )}
              </div>
              {!permissionDenied && (
                <button
                  onClick={subscribed ? unsubscribe : subscribe}
                  disabled={pushLoading}
                  className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${subscribed ? "bg-[--primary]" : "bg-[--border]"} disabled:opacity-50`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${subscribed ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-[--surface] rounded-2xl border border-[--border] overflow-hidden mb-4">
        {couple && (
          <>
            <button
              onClick={handleLeaveCouple}
              disabled={leaving}
              className="w-full flex items-center justify-between px-4 py-3.5 text-[15px] text-[#C0392B] disabled:opacity-40 active:bg-[--surface-alt] transition-colors"
            >
              <span>{leaving ? "Leaving..." : "Leave couple"}</span>
              <ChevronRight size={16} className="text-[#C0392B] opacity-60" />
            </button>
            <div className="h-px bg-[--border]" />
          </>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-between px-4 py-3.5 text-[15px] text-[#C0392B] active:bg-[--surface-alt] transition-colors"
        >
          <span>Sign out</span>
          <ChevronRight size={16} className="text-[#C0392B] opacity-60" />
        </button>
      </div>
    </div>
  );
}
