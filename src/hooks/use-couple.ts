"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRow, CoupleRow } from "@/types/database";

export interface CoupleContext {
  couple: CoupleRow | null;
  partner: UserRow | null;
  self: UserRow | null;
  loading: boolean;
}

export function useCouple(userId: string | undefined): CoupleContext {
  const [state, setState] = useState<CoupleContext>({
    couple: null,
    partner: null,
    self: null,
    loading: true,
  });

  const supabase = createClient();

  useEffect(() => {
    if (!userId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    async function load() {
      const [{ data: selfData }, { data: memberData }] = await Promise.all([
        supabase.from("users").select("*").eq("id", userId!).single(),
        supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", userId!)
          .single(),
      ]);

      if (!memberData) {
        setState({ couple: null, partner: null, self: selfData, loading: false });
        return;
      }

      const coupleId = memberData.couple_id;

      const [{ data: coupleData }, { data: partnerMember }] = await Promise.all([
        supabase.from("couples").select("*").eq("id", coupleId).single(),
        supabase
          .from("couple_members")
          .select("user_id")
          .eq("couple_id", coupleId)
          .neq("user_id", userId!)
          .single(),
      ]);

      let partner: UserRow | null = null;
      if (partnerMember) {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", partnerMember.user_id)
          .single();
        partner = data;
      }

      setState({ couple: coupleData, partner, self: selfData, loading: false });
    }

    load();
  }, [userId]);

  return state;
}
