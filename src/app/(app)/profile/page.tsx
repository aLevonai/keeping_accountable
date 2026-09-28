"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/contexts/app-data";
import { useSignOut } from "@/hooks/use-auth";
import { usePush } from "@/hooks/use-push";
import { qk, fetchActiveInvite, type CoupleData } from "@/lib/queries";
import { generateInviteCode, inviteExpiry, shareInvite } from "@/utils/invite";
import { compressImage } from "@/utils/image";
import { getSignedPhotoUrl, thumbPath } from "@/utils/storage";
import { Avatar, Toggle, PageTitle } from "@/components/ui/bits";
import { confirmSheet, toast } from "@/components/ui/feedback";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const BACKFILL_KEY = "thumbs_backfilled";
const noopSubscribe = () => () => {};
function readBackfillDone() {
  try { return localStorage.getItem(BACKFILL_KEY) === "1"; } catch { return true; }
}

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOut = useSignOut();
  const { user, couple, partner, self } = useAppData();
  const push = usePush();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const storedBackfillDone = useSyncExternalStore(noopSubscribe, readBackfillDone, () => true);
  const [backfillDone, setBackfillDone] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null);

  const invite = useQuery({
    queryKey: qk.invite(couple?.id ?? ""),
    queryFn: () => fetchActiveInvite(couple!.id),
    enabled: !!couple && !partner,
  });
  const inviteCode = invite.data ?? null;

  async function handleRegenerateCode() {
    if (!couple || !user) return;
    setRegenerating(true);
    await supabase
      .from("couple_invites")
      .update({ expires_at: new Date().toISOString() })
      .eq("couple_id", couple.id)
      .is("accepted_at", null);
    const newCode = generateInviteCode();
    const { error } = await supabase.from("couple_invites").insert({
      couple_id: couple.id,
      inviter_id: user.id,
      code: newCode,
      expires_at: inviteExpiry(),
    });
    setRegenerating(false);
    if (error) {
      toast("Couldn't create a new code.", { tone: "error" });
      return;
    }
    queryClient.setQueryData(qk.invite(couple.id), newCode);
  }

  async function handleShare() {
    if (!inviteCode) return;
    const result = await shareInvite(inviteCode);
    if (result === "copied") toast("Invite link copied");
  }

  async function handleLeaveCouple() {
    if (!couple || !user) return;
    const ok = await confirmSheet({
      title: "Leave this couple?",
      message: "You'll lose access to your shared goals, dreams and journal. This can't be undone.",
      confirmLabel: "Leave couple",
      destructive: true,
    });
    if (!ok) return;
    setLeaving(true);
    await supabase.from("couple_members").delete().eq("couple_id", couple.id).eq("user_id", user.id);
    queryClient.clear();
    router.replace("/onboard");
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !displayName.trim()) return;
    const name = displayName.trim();
    const key = qk.couple(user.id);
    const prev = queryClient.getQueryData<CoupleData>(key);
    if (prev?.self) queryClient.setQueryData(key, { ...prev, self: { ...prev.self, display_name: name } });
    setEditingName(false);
    const { error } = await supabase.from("users").update({ display_name: name }).eq("id", user.id);
    if (error) {
      if (prev) queryClient.setQueryData(key, prev);
      toast("Couldn't save your name.", { tone: "error" });
    }
  }

  async function handleBackfill() {
    const { data } = await supabase.from("completion_media").select("storage_path");
    const paths = (data ?? []).map((d) => d.storage_path as string);
    setBackfillProgress({ done: 0, total: paths.length });
    for (let i = 0; i < paths.length; i++) {
      try {
        const signedUrl = await getSignedPhotoUrl(paths[i]);
        if (signedUrl) {
          const blob = await (await fetch(signedUrl)).blob();
          const thumbnail = await compressImage(blob, 600, 0.72);
          await supabase.storage.from("media").upload(thumbPath(paths[i]), thumbnail, { upsert: true, cacheControl: "31536000" });
        }
      } catch {
        // skip failed photos, keep going
      }
      setBackfillProgress({ done: i + 1, total: paths.length });
    }
    try { localStorage.setItem(BACKFILL_KEY, "1"); } catch { /* ignore */ }
    setBackfillDone(true);
    setBackfillProgress(null);
  }

  const selfName = self?.display_name ?? "You";
  const partnerName = partner?.display_name ?? "Partner";
  const backfilling = backfillProgress !== null;

  return (
    <div className="px-5 pt-14 pb-8 min-h-screen bg-background">
      <PageTitle className="mb-6">Profile</PageTitle>

      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="w-[72px] h-[72px] rounded-full bg-primary-light flex items-center justify-center">
          <span className="text-[24px] font-semibold text-primary">{getInitials(selfName)}</span>
        </div>
        <p className="text-[17px] font-semibold text-foreground">{selfName}</p>
        <p className="text-[13px] text-muted">{user?.email}</p>
      </div>

      <div className="bg-surface rounded-2xl border border-border mb-4 overflow-hidden">
        {partner ? (
          <div className="px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">Partner</p>
            <div className="flex items-center gap-2.5">
              <Avatar name={partnerName} who="partner" size={40} />
              <div>
                <p className="text-[15px] font-medium text-foreground">{partnerName}</p>
                <p className="text-[12px] text-success">Connected</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted mb-2">Partner</p>
              <p className="text-[14px] text-muted">Your partner hasn&apos;t joined yet. Send them your invite link.</p>
            </div>
            {inviteCode && (
              <>
                <div className="h-px bg-border" />
                <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">Invite code</p>
                    <p className="text-[18px] font-semibold tracking-[0.12em] text-foreground">{inviteCode}</p>
                  </div>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 bg-primary text-white text-[13px] font-semibold rounded-full px-3.5 py-2 active:scale-95 transition-transform"
                  >
                    <Share2 size={14} />
                    Share
                  </button>
                </div>
              </>
            )}
            <div className="h-px bg-border" />
            <button
              onClick={handleRegenerateCode}
              disabled={regenerating}
              className="w-full px-4 py-3 text-[14px] text-muted text-left disabled:opacity-40"
            >
              {regenerating ? "Generating…" : inviteCode ? "Get a new code" : "Create an invite code"}
            </button>
          </>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-border mb-4 overflow-hidden">
        {editingName ? (
          <form onSubmit={handleSaveName} className="px-4 py-3.5">
            <label htmlFor="display-name" className="block text-[13px] font-medium text-foreground mb-2">Display name</label>
            <div className="flex gap-2">
              <input
                id="display-name"
                className="flex-1 min-w-0 border border-border rounded-xl px-3 py-2 text-[16px] bg-surface text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                dir="auto"
                autoFocus
              />
              <button
                type="submit"
                disabled={!displayName.trim()}
                className="px-3 py-2 bg-primary text-white text-[13px] font-medium rounded-xl disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="px-3 py-2 border border-border text-muted text-[13px] rounded-xl"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => { setDisplayName(self?.display_name ?? ""); setEditingName(true); }}
            className="w-full flex items-center justify-between px-4 py-3.5 active:bg-surface-alt transition-colors"
          >
            <span className="text-[15px] text-foreground">Edit display name</span>
            <ChevronRight size={16} className="text-muted" />
          </button>
        )}

        {push.supported && (
          <>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-[15px] text-foreground">Notifications</p>
                {push.permissionDenied ? (
                  <p className="text-[11px] text-[#B83A26] mt-0.5">Blocked. Allow notifications in your settings.</p>
                ) : (
                  <p className="text-[11px] text-muted mt-0.5">
                    {push.subscribed ? "On for this device" : "Get notified when your partner checks in"}
                  </p>
                )}
              </div>
              {!push.permissionDenied && (
                <Toggle
                  checked={push.subscribed}
                  onChange={(on) => void (on ? push.subscribe() : push.unsubscribe())}
                  disabled={push.loading}
                  label="Notifications"
                />
              )}
            </div>
          </>
        )}
      </div>

      {!storedBackfillDone && !backfillDone && (
        <div className="bg-surface rounded-2xl border border-border mb-4 overflow-hidden">
          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-foreground">Speed up journal photos</p>
              <p className="text-[11px] text-muted mt-0.5">
                {backfillProgress
                  ? `${backfillProgress.done} / ${backfillProgress.total} processed…`
                  : "Generate thumbnails for older photos"}
              </p>
            </div>
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="flex-shrink-0 px-3 py-1.5 bg-primary-light text-primary text-[12px] font-semibold rounded-lg disabled:opacity-50 active:scale-95 transition-transform"
            >
              {backfilling ? "Running…" : "Run"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-border overflow-hidden mb-4">
        {couple && (
          <>
            <button
              onClick={handleLeaveCouple}
              disabled={leaving}
              className="w-full px-4 py-3.5 text-[15px] text-[#B83A26] text-left disabled:opacity-40 active:bg-surface-alt transition-colors"
            >
              {leaving ? "Leaving…" : "Leave couple"}
            </button>
            <div className="h-px bg-border" />
          </>
        )}
        <button
          onClick={() => void signOut()}
          className="w-full px-4 py-3.5 text-[15px] text-[#B83A26] text-left active:bg-surface-alt transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
