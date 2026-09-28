"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Share2 } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/contexts/app-data";
import { useSignOut } from "@/hooks/use-auth";
import { usePush } from "@/hooks/use-push";
import { qk, fetchActiveInvite, type CoupleData } from "@/lib/queries";
import { generateInviteCode, inviteExpiry, shareInvite } from "@/utils/invite";
import { compressImage } from "@/utils/image";
import { getSignedPhotoUrl, thumbPath } from "@/utils/storage";
import { Toggle, firstName, getInitial } from "@/components/ui/bits";
import { useDreams } from "@/hooks/use-dreams";
import { PaperPage, PaperHeader, NotebookCard, Tape, InkStamp, tornBottom } from "@/components/ui/paper";
import { seeded } from "@/utils/seeded";
import { confirmSheet, toast } from "@/components/ui/feedback";

// A photo-booth square for the passport, taped at a corner.
function PassportPhoto({ name, who, tilt }: { name: string | null; who: "self" | "partner"; tilt: number }) {
  const tint = who === "self" ? "var(--primary)" : "var(--partner-accent)";
  return (
    <div className="relative" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="bg-white p-[5px] pb-[18px] shadow-[0_2px_5px_rgba(60,40,20,0.18)]">
        <div
          className="w-[86px] h-[86px] flex items-center justify-center"
          style={
            name
              ? { background: `linear-gradient(160deg, color-mix(in srgb, ${tint} 18%, white), color-mix(in srgb, ${tint} 34%, white))` }
              : { background: "repeating-linear-gradient(45deg, #F2EDE8 0 6px, #EAE3DB 6px 12px)" }
          }
        >
          <span
            className="font-[family-name:var(--font-instrument-serif)] italic text-[44px] leading-none"
            style={{ color: name ? tint : "#B8AFA7" }}
          >
            {name ? getInitial(name) : "?"}
          </span>
        </div>
      </div>
      <Tape r={seeded(`passport-${who}`)} style={{ top: -7, left: -12, transform: "rotate(-35deg)", width: 40 }} />
    </div>
  );
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
  const { user, couple, partner, self, goals } = useAppData();
  const { dreams } = useDreams(couple?.id);
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
  const partnerName = partner?.display_name ?? null;
  const backfilling = backfillProgress !== null;
  const since = couple ? new Date(couple.created_at) : null;
  const checkIns = goals.reduce((n, g) => n + g.completions.length, 0);
  const dreamsDone = dreams.filter((d) => d.achieved_at !== null).length;
  const days = since ? Math.max(1, differenceInCalendarDays(new Date(), since)) : 0;

  return (
    <PaperPage>
      <PaperHeader title="Profile" subtitle="the two of us" />

      {/* Passport */}
      <section className="relative mx-5 mt-6">
        <div
          className="relative bg-[#FFFDF8] px-4 pt-3 pb-5 shadow-[0_2px_6px_rgba(60,40,20,0.14),0_18px_28px_-18px_rgba(60,40,20,0.4)]"
          style={{ transform: "rotate(-0.6deg)" }}
        >
          <div className="flex items-center justify-between border-b border-dashed border-[rgba(138,115,94,0.35)] pb-2">
            <span className="font-mono text-[9px] font-bold tracking-[0.22em] uppercase text-primary">CheckMate · couple pass</span>
            <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted">No. {couple?.id.slice(0, 6).toUpperCase() ?? "——"}</span>
          </div>

          <div className="flex items-start justify-center gap-4 mt-5">
            <div className="flex flex-col items-center">
              <PassportPhoto name={selfName} who="self" tilt={-3} />
              <p className="font-hand text-[22px] leading-none text-[#3B332C] mt-3" dir="auto">{firstName(selfName, "You")}</p>
              <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-muted mt-1">you</p>
            </div>
            <span className="font-[family-name:var(--font-instrument-serif)] italic text-[34px] text-primary mt-9">&amp;</span>
            <div className="flex flex-col items-center">
              <PassportPhoto name={partnerName} who="partner" tilt={2.5} />
              <p className="font-hand text-[22px] leading-none text-[#3B332C] mt-3" dir="auto">
                {partnerName ? firstName(partnerName, "Partner") : "waiting…"}
              </p>
              <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-muted mt-1">partner</p>
            </div>
          </div>

          {since && (
            <p className="font-hand text-[20px] text-center text-[#6E6053] mt-4">
              together on CheckMate since {format(since, "MMMM d, yyyy")}
            </p>
          )}

          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            <InkStamp color="var(--primary)" rotate={-6}>{checkIns} check-ins</InkStamp>
            <InkStamp color="var(--success)" rotate={3}>{dreamsDone} dreams come true</InkStamp>
            <InkStamp color="var(--partner-accent)" rotate={-2}>{days} days</InkStamp>
          </div>

          <p className="font-mono text-[9px] tracking-[0.12em] text-muted text-center mt-4 truncate">{user?.email}</p>
        </div>
      </section>

      {/* Invite ticket (until the partner joins) */}
      {!partner && (
        <section className="mx-6 mt-8">
          <div className="relative flex bg-[#FFF1B8] shadow-[0_2px_5px_rgba(60,40,20,0.14)] rotate-1">
            <div className="flex-1 px-4 py-3.5 border-r-2 border-dashed border-[rgba(138,115,94,0.45)]">
              <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-[#8A735E]">Admit one · your partner</p>
              <p className="font-mono text-[20px] font-bold tracking-[0.1em] text-[#3B332C] mt-1">{inviteCode ?? "———"}</p>
              <button
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="font-hand text-[17px] text-[#8A735E] mt-1 disabled:opacity-40"
              >
                {regenerating ? "printing a new one…" : inviteCode ? "get a new code" : "create an invite code"}
              </button>
            </div>
            <button
              onClick={handleShare}
              disabled={!inviteCode}
              className="w-[92px] flex flex-col items-center justify-center gap-1 text-primary disabled:opacity-40 active:bg-black/5"
            >
              <Share2 size={20} />
              <span className="font-hand text-[18px] leading-none">send</span>
            </button>
            {/* Ticket notches */}
            <span aria-hidden className="absolute -top-2 right-[84px] w-4 h-4 rounded-full paper-bg" />
            <span aria-hidden className="absolute -bottom-2 right-[84px] w-4 h-4 rounded-full paper-bg" />
          </div>
        </section>
      )}

      {/* Settings on notebook paper */}
      <section className="mx-4 mt-9">
        <NotebookCard tilt={0.5}>
          <div aria-hidden className="absolute top-0 bottom-0 left-[40px] w-px bg-[rgba(214,120,120,0.5)]" />
          <p className="font-hand text-[26px] leading-none text-[#3B332C] pl-[52px] pt-4 pb-3">settings</p>

          <div className="border-t border-[rgba(120,160,200,0.32)] pl-[52px]">
            {editingName ? (
              <form onSubmit={handleSaveName} className="pr-4 py-3">
                <label htmlFor="display-name" className="block font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-1.5">Display name</label>
                <div className="flex gap-2">
                  <input
                    id="display-name"
                    className="flex-1 min-w-0 border border-border rounded-xl px-3 py-2 text-[16px] bg-surface text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    dir="auto"
                    autoFocus
                  />
                  <button type="submit" disabled={!displayName.trim()} className="px-3 py-2 bg-primary text-white text-[13px] font-medium rounded-xl disabled:opacity-40">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingName(false)} className="px-2 py-2 text-muted text-[13px]">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => { setDisplayName(self?.display_name ?? ""); setEditingName(true); }}
                className="w-full flex items-center justify-between pr-4 min-h-[54px] active:bg-black/[0.03] text-left"
              >
                <div>
                  <p className="text-[15px] text-foreground">Display name</p>
                  <p className="font-hand text-[17px] leading-none text-[#8A7B6E]" dir="auto">{selfName}</p>
                </div>
                <ChevronRight size={16} className="text-muted" />
              </button>
            )}
          </div>

          {push.supported && (
            <div className="border-t border-[rgba(120,160,200,0.32)] pl-[52px] pr-4 min-h-[58px] flex items-center justify-between gap-3">
              <div className="min-w-0 py-2">
                <p className="text-[15px] text-foreground">Notifications</p>
                {push.permissionDenied ? (
                  <p className="text-[11px] text-[#B83A26] mt-0.5">Blocked. Allow notifications in your settings.</p>
                ) : (
                  <p className="font-hand text-[17px] leading-none text-[#8A7B6E]">
                    {push.subscribed ? "on for this device" : "hear when your partner checks in"}
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
          )}

          {!storedBackfillDone && !backfillDone && (
            <div className="border-t border-[rgba(120,160,200,0.32)] pl-[52px] pr-4 min-h-[58px] flex items-center justify-between gap-3">
              <div className="min-w-0 py-2">
                <p className="text-[15px] text-foreground">Speed up journal photos</p>
                <p className="font-hand text-[17px] leading-none text-[#8A7B6E]">
                  {backfillProgress ? `${backfillProgress.done} / ${backfillProgress.total} processed…` : "thumbnails for older photos"}
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
          )}
          <div className="h-2" />
        </NotebookCard>
      </section>

      {/* Account slip */}
      <section className="mx-8 mt-9" style={{ filter: "drop-shadow(0 2px 3px rgba(60,40,20,0.12))" }}>
        <div className="bg-[#FFFDF8] px-4 pt-2 pb-5" style={{ clipPath: tornBottom("account-slip", 18), transform: "rotate(-1deg)" }}>
          {couple && (
            <button
              onClick={handleLeaveCouple}
              disabled={leaving}
              className="w-full py-3 text-[15px] text-[#B83A26] text-left disabled:opacity-40 border-b border-dashed border-[rgba(138,115,94,0.3)]"
            >
              {leaving ? "Leaving…" : "Leave couple"}
            </button>
          )}
          <button onClick={() => void signOut()} className="w-full py-3 text-[15px] text-[#B83A26] text-left">
            Sign out
          </button>
        </div>
      </section>
    </PaperPage>
  );
}
