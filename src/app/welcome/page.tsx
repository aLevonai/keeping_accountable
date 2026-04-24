"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppLogo } from "@/components/ui/logo";
import { Mail } from "lucide-react";

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

    const { data: member } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", data.user.id)
      .single();

    router.push(member ? "/home" : "/onboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-7 pb-12 bg-[--background]">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo lockup */}
        <div className="flex flex-col items-center gap-3 mb-12">
          <AppLogo size={64} />
          <h1 className="font-[family-name:var(--font-instrument-serif)] italic text-[32px] text-[--foreground] leading-none">
            CheckMate
          </h1>
          <p className="text-[14px] text-[--muted] text-center leading-relaxed">
            Set goals, prove them,<br />build memories — together.
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="w-full flex flex-col gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[--muted] mb-1.5">
                Your email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3.5 border border-[--border] rounded-2xl bg-[--surface] text-[15px] text-[--foreground] placeholder:text-[--muted] outline-none focus:border-[--primary]"
              />
              {error && <p className="text-[13px] text-red-500 mt-1.5">{error}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[--primary] text-[--foreground] rounded-2xl text-[15px] font-semibold mt-1 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Continue"}
            </button>
          </form>
        ) : (
          <div className="w-full flex flex-col gap-3">
            {/* Confirmation card */}
            <div className="bg-[--surface] border border-[--border] rounded-2xl p-5 flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-[--primary-light] flex items-center justify-center">
                <Mail size={18} className="text-[--primary]" />
              </div>
              <p className="text-[14px] font-semibold text-[--foreground]">Check your email</p>
              <p className="text-[13px] text-[--muted]">
                We sent a code to{" "}
                <span className="font-semibold text-[--foreground]">{email}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[--muted] mb-1.5">
                  8-digit code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="12345678"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  required
                  autoFocus
                  maxLength={8}
                  className="w-full px-4 py-3.5 border border-[--border] rounded-2xl bg-[--surface] text-center text-[22px] font-semibold tracking-[0.18em] text-[--foreground] outline-none focus:border-[--primary]"
                />
                {error && <p className="text-[13px] text-red-500 mt-1.5">{error}</p>}
              </div>
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-4 bg-[--primary] text-[--foreground] rounded-2xl text-[15px] font-semibold disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Sign in"}
              </button>
            </form>

            <button
              onClick={() => { setStep("email"); setCode(""); setError(""); }}
              className="text-[13px] text-[--muted] text-center mt-1"
            >
              Use a different email
            </button>
          </div>
        )}

        <p className="text-[11px] text-[--muted] text-center mt-7">
          No password needed — we&apos;ll email you a code.
        </p>
      </div>
    </div>
  );
}
