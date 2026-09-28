"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { rememberPendingInvite, takePendingInvite } from "@/utils/invite";
import { AppLogo } from "@/components/ui/logo";

export function JoinRedirect({ code }: { code: string }) {
  const router = useRouter();

  useEffect(() => {
    rememberPendingInvite(code);
    const supabase = createClient();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/welcome");
        return;
      }
      const { data: member } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (member) {
        // Already paired — nothing to join.
        takePendingInvite();
        router.replace("/home");
      } else {
        router.replace("/onboard");
      }
    })();
  }, [code, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-8 text-center">
      <div className="animate-pulse"><AppLogo size={48} /></div>
      <p className="font-[family-name:var(--font-instrument-serif)] italic text-[22px] text-foreground">You&apos;ve been invited</p>
      <p className="text-[13px] text-muted">Code {code}</p>
    </div>
  );
}
