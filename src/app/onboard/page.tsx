"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppLogo } from "@/components/ui/logo";

type Step = "name" | "choose" | "create" | "join";

function generateInviteCode() {
  const words = ["ROSE", "MOON", "LOVE", "STAR", "BLOOM", "SOUL", "BOND", "GLOW"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}

export default function OnboardPage() {
  const [step, setStep] = useState<Step>("name");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSaveName() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("users").upsert(
      { id: user.id, display_name: displayName.trim() },
      { onConflict: "id" }
    );
    setStep("choose");
    setLoading(false);
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
    const { error: coupleError } = await supabase
      .from("couples")
      .insert({ id: coupleId });

    if (coupleError) {
      setError(`Failed to create couple: ${coupleError.message}`);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("couple_members")
      .insert({ couple_id: coupleId, user_id: user.id });

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
      expires_at: "2099-01-01T00:00:00Z",
    });

    setGeneratedCode(code);
    setStep("create");
    setLoading(false);
  }

  async function handleJoinCouple() {
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: invite } = await supabase
      .from("couple_invites")
      .select("*")
      .eq("code", inviteCode.trim().toUpperCase())
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!invite) {
      setError("Code not found or expired. Double-check with your partner.");
      setLoading(false);
      return;
    }

    await Promise.all([
      supabase.from("couple_members").insert({ couple_id: invite.couple_id, user_id: user.id }),
      supabase.from("couple_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id),
    ]);

    router.push("/home");
  }

  if (step === "name") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-7 pb-12 bg-[--background]">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <AppLogo size={48} />
            <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-[--foreground] text-center">
              What should we call you?
            </h1>
            <p className="text-[13px] text-[--muted] text-center">Your partner will see this name</p>
          </div>
          <div className="w-full flex flex-col gap-3">
            <input
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              className="w-full px-4 py-3.5 border border-[--border] rounded-2xl bg-[--surface] text-[15px] text-[--foreground] placeholder:text-[--muted] outline-none focus:border-[--primary]"
            />
            <button
              onClick={handleSaveName}
              disabled={!displayName.trim() || loading}
              className="w-full py-4 bg-[--primary] text-[--foreground] rounded-2xl text-[15px] font-semibold disabled:opacity-60"
            >
              {loading ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "choose") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-7 pb-12 bg-[--background]">
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-[--foreground] text-center">
              Connect with your partner
            </h1>
          </div>
          {error && <p className="text-[13px] text-red-500 text-center">{error}</p>}
          <button
            onClick={handleCreateCouple}
            disabled={loading}
            className="bg-[--surface] border border-[--border] rounded-2xl p-5 text-left active:scale-[0.98] transition-transform"
          >
            <p className="text-[15px] font-semibold text-[--foreground]">Start a couple</p>
            <p className="text-[13px] text-[--muted] mt-1">Get an invite code to share with your partner</p>
          </button>
          <button
            onClick={() => setStep("join")}
            className="bg-[--surface] border border-[--border] rounded-2xl p-5 text-left active:scale-[0.98] transition-transform"
          >
            <p className="text-[15px] font-semibold text-[--foreground]">Join with a code</p>
            <p className="text-[13px] text-[--muted] mt-1">Your partner already started — enter their code</p>
          </button>
        </div>
      </div>
    );
  }

  if (step === "create") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-7 pb-12 bg-[--background]">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <AppLogo size={48} />
            <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-[--foreground] text-center">
              Your couple is ready
            </h1>
          </div>
          <div className="w-full bg-[--primary-light] border-2 border-dashed border-[--primary]/40 rounded-2xl px-6 py-6 flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[--primary]">Invite Code</span>
            <span className="text-[30px] font-bold tracking-[0.14em] text-[--foreground]">{generatedCode}</span>
          </div>
          <p className="text-[11px] text-[--muted]">Expires in 7 days</p>
          <button
            onClick={() => router.push("/home")}
            className="w-full py-4 bg-[--primary] text-white rounded-2xl text-[15px] font-semibold"
          >
            I&apos;ll wait for them inside
          </button>
        </div>
      </div>
    );
  }

  // join step
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-7 pb-12 bg-[--background]">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 mb-2">
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[24px] text-[--foreground] text-center">
            Enter the invite code
          </h1>
        </div>
        <div>
          <input
            placeholder="ROSE-1234"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="w-full px-4 py-3.5 border border-[--border] rounded-2xl bg-[--surface] text-center text-[20px] font-bold tracking-[0.14em] uppercase text-[--foreground] placeholder:text-[--muted] placeholder:normal-case placeholder:tracking-normal outline-none focus:border-[--primary]"
          />
          {error && <p className="text-[13px] text-red-500 mt-1.5">{error}</p>}
        </div>
        <button
          onClick={handleJoinCouple}
          disabled={!inviteCode.trim() || loading}
          className="w-full py-4 bg-[--primary] text-[--foreground] rounded-2xl text-[15px] font-semibold disabled:opacity-60"
        >
          {loading ? "Joining..." : "Join"}
        </button>
        <button
          onClick={() => setStep("choose")}
          className="text-[13px] text-[--muted] text-center"
        >
          ← Go back
        </button>
      </div>
    </div>
  );
}
