"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "choose" | "create" | "join" | "name";

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
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#fffaf7]">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="text-5xl">👋</div>
            <h1 className="text-2xl font-bold text-stone-900">What should we call you?</h1>
            <p className="text-stone-500 text-sm text-center">Your partner will see this name</p>
          </div>
          <Input
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
          />
          <Button size="lg" onClick={handleSaveName} disabled={!displayName.trim() || loading}>
            {loading ? "Saving..." : "Continue →"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "choose") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#fffaf7]">
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="text-5xl">💞</div>
            <h1 className="text-2xl font-bold text-stone-900">Connect with your partner</h1>
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            onClick={handleCreateCouple}
            disabled={loading}
            className="flex flex-col gap-1 bg-white rounded-3xl p-5 border border-stone-100 shadow-sm text-left active:scale-95 transition-transform"
          >
            <span className="text-2xl">✨</span>
            <span className="font-bold text-stone-900">Start a couple</span>
            <span className="text-sm text-stone-500">Get an invite code to share with your partner</span>
          </button>
          <button
            onClick={() => setStep("join")}
            className="flex flex-col gap-1 bg-white rounded-3xl p-5 border border-stone-100 shadow-sm text-left active:scale-95 transition-transform"
          >
            <span className="text-2xl">🔗</span>
            <span className="font-bold text-stone-900">Join with a code</span>
            <span className="text-sm text-stone-500">Your partner already started — enter their code</span>
          </button>
        </div>
      </div>
    );
  }

  if (step === "create") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#fffaf7]">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="text-5xl">🎉</div>
            <h1 className="text-2xl font-bold text-stone-900">Your couple is ready!</h1>
            <p className="text-stone-500 text-sm text-center">Share this code with your partner so they can join</p>
          </div>
          <div className="bg-rose-50 border-2 border-dashed border-rose-200 rounded-3xl px-8 py-6 flex flex-col items-center gap-1">
            <span className="text-xs text-rose-400 font-semibold uppercase tracking-widest">Invite Code</span>
            <span className="text-4xl font-bold text-rose-600 tracking-widest">{generatedCode}</span>
          </div>
          <p className="text-stone-400 text-xs text-center">Code expires in 7 days</p>
          <Button size="lg" onClick={() => router.push("/home")}>
            I&apos;ll wait for them inside →
          </Button>
        </div>
      </div>
    );
  }

  // join step
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#fffaf7]">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="text-5xl">🔗</div>
          <h1 className="text-2xl font-bold text-stone-900">Enter your invite code</h1>
          <p className="text-stone-500 text-sm text-center">Ask your partner for their code</p>
        </div>
        <Input
          placeholder="ROSE-1234"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="text-center text-xl font-bold tracking-widest uppercase"
          error={error}
        />
        <Button size="lg" onClick={handleJoinCouple} disabled={!inviteCode.trim() || loading}>
          {loading ? "Joining..." : "Join 💑"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setStep("choose")}>
          ← Go back
        </Button>
      </div>
    </div>
  );
}
