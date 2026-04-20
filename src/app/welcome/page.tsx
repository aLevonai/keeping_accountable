"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WelcomePage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
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

        {sent ? (
          <div className="w-full flex flex-col items-center gap-4 bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
            <div className="text-4xl">📬</div>
            <h2 className="text-xl font-bold text-stone-900">Check your email</h2>
            <p className="text-stone-500 text-center text-sm">
              We sent a magic link to <span className="font-semibold text-stone-700">{email}</span>. Tap it to sign in.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSent(false)}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
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
        )}

        <p className="text-xs text-stone-400 text-center">
          We&apos;ll send you a magic link — no password needed.
        </p>
      </div>
    </div>
  );
}
