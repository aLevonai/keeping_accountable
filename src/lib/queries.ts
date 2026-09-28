// Query keys + fetchers for everything the app reads. Hooks live next to the
// UI that uses them; this file is the single source of truth for keys and
// query shapes so realtime sync and mutations can target the same cache.

import { createClient } from "@/lib/supabase/client";
import type {
  CoupleRow,
  UserRow,
  GoalWithCompletions,
  CompletionWithMedia,
  DreamRow,
  JournalCompletion,
  GoalReminderRow,
} from "@/types/database";

export const qk = {
  session: ["session"] as const,
  couple: (userId: string) => ["couple", userId] as const,
  goals: (coupleId: string) => ["goals", coupleId] as const,
  goal: (goalId: string) => ["goal", goalId] as const,
  goalHistory: (goalId: string) => ["goal-history", goalId] as const,
  reminder: (goalId: string, userId: string) => ["reminder", goalId, userId] as const,
  dreams: (coupleId: string) => ["dreams", coupleId] as const,
  journal: (coupleId: string) => ["journal", coupleId] as const,
  invite: (coupleId: string) => ["invite", coupleId] as const,
};

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface CoupleData {
  couple: CoupleRow | null;
  self: UserRow | null;
  partner: UserRow | null;
}

const supabase = () => createClient();

export async function fetchSession(): Promise<SessionUser | null> {
  // getSession reads the local cookie session — no network round-trip unless
  // the access token needs refreshing. The proxy already verified it.
  const { data } = await supabase().auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? null } : null;
}

export async function fetchCouple(userId: string): Promise<CoupleData> {
  // One round-trip: self row + membership → couple → both members' user rows.
  const [selfRes, memberRes] = await Promise.all([
    supabase().from("users").select("*").eq("id", userId).maybeSingle(),
    supabase()
      .from("couple_members")
      .select("couple_id, couples(id, created_at, couple_members(user_id, users(*)))")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (selfRes.error) throw selfRes.error;
  if (memberRes.error) throw memberRes.error;

  const self = (selfRes.data as UserRow | null) ?? null;
  type Nested = {
    couple_id: string;
    couples: {
      id: string;
      created_at: string;
      couple_members: { user_id: string; users: UserRow | null }[];
    } | null;
  };
  const member = memberRes.data as Nested | null;
  if (!member?.couples) return { couple: null, self, partner: null };

  const { couple_members, ...couple } = member.couples;
  const partner = couple_members.find((m) => m.user_id !== userId)?.users ?? null;
  return { couple, self, partner };
}

export async function fetchGoals(coupleId: string): Promise<GoalWithCompletions[]> {
  const { data, error } = await supabase()
    .from("goals")
    .select("*, completions(id, goal_id, user_id, completed_at)")
    .eq("couple_id", coupleId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .order("completed_at", { referencedTable: "completions", ascending: true });
  if (error) throw error;
  return (data ?? []) as GoalWithCompletions[];
}

// Used when a goal isn't in the active list (archived, or opened from a
// notification before the list has loaded).
export async function fetchGoal(goalId: string): Promise<GoalWithCompletions | null> {
  const { data, error } = await supabase()
    .from("goals")
    .select("*, completions(id, goal_id, user_id, completed_at)")
    .eq("id", goalId)
    .order("completed_at", { referencedTable: "completions", ascending: true })
    .maybeSingle();
  if (error) throw error;
  return (data as GoalWithCompletions | null) ?? null;
}

// Newest first.
export async function fetchGoalHistory(goalId: string): Promise<CompletionWithMedia[]> {
  const { data, error } = await supabase()
    .from("completions")
    .select("id, goal_id, user_id, note, completed_at, completion_media(id, storage_path, width, height)")
    .eq("goal_id", goalId)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompletionWithMedia[];
}

export async function fetchReminder(goalId: string, userId: string): Promise<GoalReminderRow | null> {
  const { data, error } = await supabase()
    .from("goal_reminders")
    .select("*")
    .eq("goal_id", goalId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as GoalReminderRow | null) ?? null;
}

export async function fetchDreams(coupleId: string): Promise<DreamRow[]> {
  const { data, error } = await supabase()
    .from("dreams")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DreamRow[];
}

export const JOURNAL_PAGE_SIZE = 24;

// Cursor pagination on completed_at (newest first).
export async function fetchJournalPage(
  coupleId: string,
  before: string | null
): Promise<JournalCompletion[]> {
  let q = supabase()
    .from("completions")
    .select(
      "id, goal_id, user_id, note, completed_at, goals!inner(title, color, couple_id), completion_media(id, storage_path, width, height)"
    )
    .eq("goals.couple_id", coupleId)
    .order("completed_at", { ascending: false })
    .limit(JOURNAL_PAGE_SIZE);
  if (before) q = q.lt("completed_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as JournalCompletion[];
}

export async function fetchActiveInvite(coupleId: string): Promise<string | null> {
  const { data } = await supabase()
    .from("couple_invites")
    .select("code")
    .eq("couple_id", coupleId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.code as string | undefined) ?? null;
}
