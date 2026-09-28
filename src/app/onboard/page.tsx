"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateInviteCode, inviteExpiry, shareInvite, peekPendingInvite, takePendingInvite } from "@/utils/invite";
import { AppLogo } from "@/components/ui/logo";
import { toast } from "@/components/ui/feedback";

type Step = "name" | "choose" | "create" | "join";

const noopSubscribe = () => () => {};
const inputClass =
  "w-full px-4 py-3.5 border border-border rounded-2xl bg-surface text-[16px] text-foreground placeholder:text-muted outline-none focus:border-primary";
const primaryButton =
  "w-full py-4 bg-primary text-white rounded-2xl text-[15px] font-semibold disabled:opacity-60 active:scale-[0.98] transition-transform";

export default function OnboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();
  // A code from a /join link the partner shared, if the user arrived that way.
  const pendingCode = useSyncExternalStore(noopSubscribe, peekPendingInvite, () => null);

  const [step, setStep] = useState<Step>("name");
  const [displayName, setDisplayName] = useState("");
  const [typedCode, setTypedCode] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inviteCode = typedCode ?? pendingCode ?? "";

  async function handleSaveName() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace("/welcome");
      return;
    }
    await supabase.from("users").upsert({ id: user.id, display_name: displayName.trim() }, { onConflict: "id" });
    setLoading(false);
    setStep(pendingCode ? "join" : "choose");
  }

  async function handleCreateCouple() {
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in. Please go back and sign in again.");
      setLoading(false);
      return;
    }

    const coupleId = crypto.randomUUID();
    const { error: coupleError } = await supabase.from("couples").insert({ id: coupleId });
    if (coupleError) {
      setError(`Failed to create couple: ${coupleError.message}`);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from("couple_members").insert({ couple_id: coupleId, user_id: user.id });
    if (memberError) {
      setError(`Failed to join couple: ${memberError.message}`);
      setLoading(false);
      return;
    }

    const code = generateInviteCode();
    await supabase.from("couple_invites").insert({
      couple_id: coupleId,
      inviter_id: user.id,
      code,
      expires_at: inviteExpiry(),
    });

    queryClient.invalidateQueries({ queryKey: ["couple"] });
    setGeneratedCode(code);
    setStep("create");
    setLoading(false);
  }

  async function handleJoinCouple() {
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace("/welcome");
      return;
    }

    const { data: invite } = await supabase
      .from("couple_invites")
      .select("*")
      .eq("code", inviteCode.trim().toUpperCase())
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!invite) {
      setError("Code not found or expired. Double-check with your partner.");
      setLoading(false);
      return;
    }

    const [{ error: joinError }] = await Promise.all([
      supabase.from("couple_members").insert({ couple_id: invite.couple_id, user_id: user.id }),
      supabase.from("couple_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id),
    ]);
    if (joinError) {
      setError("Couldn't join — this couple may already be full.");
      setLoading(false);
      return;
    }

    takePendingInvite();
    queryClient.invalidateQueries({ queryKey: ["couple"] });
    router.replace("/home");
  }

  const shell = (children: React.ReactNode) => (
    <div className="paper-bg min-h-screen flex flex-col items-center justify-center px-7 pb-12">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">{children}</div>
    </div>
  );
  const title = (text: string) => (
    <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-foreground text-center">{text}</h1>
  );

  if (step === "name") {
    return shell(
      <>
        <div className="flex flex-col items-center gap-3">
          <AppLogo size={48} />
          {title("What should we call you?")}
          <p className="text-[13px] text-muted text-center">Your partner will see this name</p>
        </div>
        <div className="w-full flex flex-col gap-3">
          <input
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && displayName.trim()) void handleSaveName(); }}
            dir="auto"
            autoFocus
            className={inputClass}
          />
          <button onClick={handleSaveName} disabled={!displayName.trim() || loading} className={primaryButton}>
            {loading ? "Saving…" : "Continue"}
          </button>
        </div>
      </>
    );
  }

  if (step === "choose") {
    return shell(
      <div className="w-full flex flex-col gap-4">
        <div className="mb-2">{title("Connect with your partner")}</div>
        {error && <p className="text-[13px] text-[#B83A26] text-center">{error}</p>}
        <button
          onClick={handleCreateCouple}
          disabled={loading}
          className="bg-surface border border-border rounded-2xl p-5 text-left active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          <p className="text-[15px] font-semibold text-foreground">{loading ? "Setting up…" : "Start a couple"}</p>
          <p className="text-[13px] text-muted mt-1">Get an invite link to send your partner</p>
        </button>
        <button
          onClick={() => setStep("join")}
          className="bg-surface border border-border rounded-2xl p-5 text-left active:scale-[0.98] transition-transform"
        >
          <p className="text-[15px] font-semibold text-foreground">Join with a code</p>
          <p className="text-[13px] text-muted mt-1">Your partner already started — enter their code</p>
        </button>
      </div>
    );
  }

  if (step === "create") {
    return shell(
      <>
        <div className="flex flex-col items-center gap-3">
          <AppLogo size={48} />
          {title("Your couple is ready")}
        </div>
        <div className="w-full bg-primary-light border-2 border-dashed border-primary/40 rounded-2xl px-6 py-6 flex flex-col items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Invite code</span>
          <span className="text-[28px] font-bold tracking-[0.12em] text-foreground">{generatedCode}</span>
          <span className="text-[11px] text-muted">Expires in 7 days</span>
        </div>
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={async () => {
              const r = await shareInvite(generatedCode);
              if (r === "copied") toast("Invite link copied");
            }}
            className={`${primaryButton} flex items-center justify-center gap-2`}
          >
            <Share2 size={16} />
            Send invite link
          </button>
          <button onClick={() => router.replace("/home")} className="w-full py-3.5 text-[14px] font-medium text-muted">
            I&apos;ll wait for them inside
          </button>
        </div>
      </>
    );
  }

  return shell(
    <div className="w-full flex flex-col gap-4">
      <div className="mb-2">{title(pendingCode ? "Join your partner" : "Enter the invite code")}</div>
      <div>
        <input
          placeholder="ROSE-123456"
          value={inviteCode}
          onChange={(e) => setTypedCode(e.target.value)}
          autoCapitalize="characters"
          className={`${inputClass} text-center text-[20px] font-bold tracking-[0.14em] uppercase placeholder:normal-case placeholder:tracking-normal`}
        />
        {error && <p className="text-[13px] text-[#B83A26] mt-1.5">{error}</p>}
      </div>
      <button onClick={handleJoinCouple} disabled={!inviteCode.trim() || loading} className={primaryButton}>
        {loading ? "Joining…" : "Join"}
      </button>
      <button onClick={() => setStep("choose")} className="text-[13px] text-muted text-center">
        ← Go back
      </button>
    </div>
  );
}
