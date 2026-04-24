"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WelcomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setStep("code");
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    if (error || !data.user) {
      setError("Invalid or expired code. Check your email or request a new one.");
      setLoading(false);
      return;
    }

    // Check if user has a couple
    const { data: member } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", data.user.id)
      .single();

    router.push(member ? "/home" : "/onboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#fffaf7]">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo / Hero */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-6xl">💑</div>
          <h1 className="text-4xl font-bold text-stone-900 tracking-tight">Together</h1>
          <p className="text-stone-500 text-center text-base leading-relaxed">
            Set goals, prove them, build memories — together.
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="w-full flex flex-col gap-4">
            <Input
              label="Your email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              error={error}
            />
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Sending..." : "Continue with email ✨"}
            </Button>
          </form>
        ) : (
          <div className="w-full flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
              <div className="text-4xl">📬</div>
              <h2 className="text-xl font-bold text-stone-900">Check your email</h2>
              <p className="text-stone-500 text-center text-sm">
                We sent an 8-digit code to <span className="font-semibold text-stone-700">{email}</span>
              </p>
            </div>
            <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
              <Input
                label="8-digit code"
                type="text"
                inputMode="numeric"
                placeholder="12345678"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                required
                autoFocus
                error={error}
              />
              <Button type="submit" size="lg" disabled={loading || code.length < 6}>
                {loading ? "Verifying..." : "Sign in →"}
              </Button>
            </form>
            <button
              onClick={() => { setStep("email"); setCode(""); setError(""); }}
              className="text-sm text-stone-400 underline text-center"
            >
              Use a different email
            </button>
          </div>
        )}

        <p className="text-xs text-stone-400 text-center">
          No password needed — we&apos;ll email you a code.
        </p>
      </div>
    </div>
  );
}
