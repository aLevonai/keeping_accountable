"use client";

import { useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient, type InfiniteData } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { qk } from "@/lib/queries";
import { useAppData } from "@/contexts/app-data";
import { prepareImage } from "@/utils/image";
import { uploadPhoto, removePhotos } from "@/utils/storage";
import { toast } from "@/components/ui/feedback";
import type {
  GoalWithCompletions,
  CompletionLite,
  CompletionWithMedia,
  DreamRow,
  JournalCompletion,
  MediaLite,
  Cadence,
} from "@/types/database";

// All writes go through here. Each one updates the query cache first
// (optimistic), then talks to Supabase, and rolls back with a toast on error —
// so taps feel instant and every screen stays in sync.

const sb = () => createClient();

// ── Upload tracking (for "Saving photo…" states) ─────────────────────────

const uploading = new Set<string>();
const uploadListeners = new Set<() => void>();
let uploadVersion = 0;
function setUploading(id: string, on: boolean) {
  if (on) uploading.add(id); else uploading.delete(id);
  uploadVersion++;
  uploadListeners.forEach((l) => l());
}
export function useIsUploading(id: string | undefined): boolean {
  useSyncExternalStore(
    (l) => { uploadListeners.add(l); return () => { uploadListeners.delete(l); }; },
    () => uploadVersion,
    () => 0
  );
  return !!id && uploading.has(id);
}

// Check-ins undone while their photo is still uploading.
const cancelled = new Set<string>();

// ── Cache helpers ─────────────────────────────────────────────────────────

function patchGoals(qc: QueryClient, coupleId: string, fn: (goals: GoalWithCompletions[]) => GoalWithCompletions[]) {
  const key = qk.goals(coupleId);
  const prev = qc.getQueryData<GoalWithCompletions[]>(key);
  if (prev) qc.setQueryData(key, fn(prev));
  return () => qc.setQueryData(key, prev);
}

function addCompletionToGoals(goals: GoalWithCompletions[], c: CompletionLite) {
  return goals.map((g) =>
    g.id === c.goal_id
      ? {
          ...g,
          completions: [...g.completions.filter((x) => x.id !== c.id), c].sort((a, b) =>
            a.completed_at.localeCompare(b.completed_at)
          ),
        }
      : g
  );
}

function removeCompletionEverywhere(qc: QueryClient, coupleId: string, completionId: string, goalId: string) {
  const undoGoals = patchGoals(qc, coupleId, (goals) =>
    goals.map((g) =>
      g.id === goalId ? { ...g, completions: g.completions.filter((c) => c.id !== completionId) } : g
    )
  );
  const histKey = qk.goalHistory(goalId);
  const prevHist = qc.getQueryData<CompletionWithMedia[]>(histKey);
  if (prevHist) qc.setQueryData(histKey, prevHist.filter((c) => c.id !== completionId));
  const jKey = qk.journal(coupleId);
  const prevJournal = qc.getQueryData<InfiniteData<JournalCompletion[], string | null>>(jKey);
  if (prevJournal) {
    qc.setQueryData(jKey, {
      ...prevJournal,
      pages: prevJournal.pages.map((p) => p.filter((c) => c.id !== completionId)),
    });
  }
  return () => {
    undoGoals();
    if (prevHist) qc.setQueryData(histKey, prevHist);
    if (prevJournal) qc.setQueryData(jKey, prevJournal);
  };
}

function refreshMemories(qc: QueryClient, coupleId: string, goalId?: string) {
  if (goalId) qc.invalidateQueries({ queryKey: qk.goalHistory(goalId) });
  qc.invalidateQueries({ queryKey: qk.journal(coupleId) });
}

async function notifyPartner(title: string, body: string, url: string) {
  try {
    await sb().functions.invoke("send-push", { body: { title, body, url } });
  } catch {
    // best-effort
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useActions() {
  const qc = useQueryClient();
  const { user, couple, self, partner } = useAppData();
  const coupleId = couple?.id ?? "";
  const userId = user?.id ?? "";
  const selfName = self?.display_name?.split(" ")[0] ?? "Your partner";

  // ── Check-ins ──

  async function attachPhoto(
    completionId: string,
    goalId: string,
    file: Blob,
    opts: { replace?: MediaLite; notify?: { title: string } } = {}
  ) {
    setUploading(completionId, true);
    try {
      const img = await prepareImage(file);
      const path = await uploadPhoto(img, "completions", coupleId, userId, completionId);
      if (cancelled.has(completionId)) {
        await removePhotos([path]);
        return;
      }
      const { error } = await sb().from("completion_media").insert({
        completion_id: completionId,
        storage_path: path,
        media_type: "photo",
        width: img.width || null,
        height: img.height || null,
      });
      if (error) {
        await removePhotos([path]);
        throw error;
      }
      if (opts.replace) {
        await sb().from("completion_media").delete().eq("id", opts.replace.id);
        await removePhotos([opts.replace.storage_path]);
      }
      refreshMemories(qc, coupleId, goalId);
      if (opts.notify && partner) {
        void notifyPartner("CheckMate", `${selfName} checked in on "${opts.notify.title}" 📸`, `/journal?open=${completionId}`);
      }
    } catch (err) {
      console.error("Photo upload failed:", err);
      if (!cancelled.has(completionId)) toast("Couldn't save the photo. Try adding it again from the goal.", { tone: "error" });
    } finally {
      setUploading(completionId, false);
    }
  }

  /** Logs a check-in. Resolves once the row is saved; a photo keeps uploading in the background. */
  async function logCheckIn(params: {
    goal: GoalWithCompletions;
    completedAt?: Date;
    note?: string;
    photo?: Blob | null;
  }): Promise<string | null> {
    const { goal } = params;
    const id = crypto.randomUUID();
    const completed_at = (params.completedAt ?? new Date()).toISOString();
    const rollback = patchGoals(qc, coupleId, (goals) =>
      addCompletionToGoals(goals, { id, goal_id: goal.id, user_id: userId, completed_at })
    );

    const { error } = await sb().from("completions").insert({
      id,
      goal_id: goal.id,
      user_id: userId,
      note: params.note?.trim() || null,
      completed_at,
    });
    if (error) {
      rollback();
      toast("Couldn't save your check-in. Try again.", { tone: "error" });
      return null;
    }
    refreshMemories(qc, coupleId, goal.id);

    if (params.photo) {
      void attachPhoto(id, goal.id, params.photo, { notify: { title: goal.title } });
    } else if (partner) {
      void notifyPartner("CheckMate", `${selfName} checked in on "${goal.title}"`, `/goals/${goal.id}`);
    }
    return id;
  }

  async function deleteCheckIn(c: { id: string; goal_id: string; completion_media?: MediaLite[] }) {
    cancelled.add(c.id);
    const rollback = removeCompletionEverywhere(qc, coupleId, c.id, c.goal_id);
    // Media paths may only be known from the history cache (e.g. undo right after upload).
    const known =
      c.completion_media ??
      qc.getQueryData<CompletionWithMedia[]>(qk.goalHistory(c.goal_id))?.find((x) => x.id === c.id)?.completion_media ??
      [];
    const { data: media } = await sb().from("completion_media").select("storage_path").eq("completion_id", c.id);
    const { error } = await sb().from("completions").delete().eq("id", c.id);
    if (error) {
      cancelled.delete(c.id);
      rollback();
      toast("Couldn't delete that check-in.", { tone: "error" });
      return false;
    }
    const paths = new Set([...known.map((m) => m.storage_path), ...(media ?? []).map((m) => m.storage_path as string)]);
    void removePhotos([...paths]);
    refreshMemories(qc, coupleId, c.goal_id);
    return true;
  }

  /** Instant check-in with an Undo toast. */
  async function quickCheckIn(goal: GoalWithCompletions) {
    const id = await logCheckIn({ goal });
    if (!id) return;
    toast(`Logged “${goal.title}”`, {
      action: { label: "Undo", onClick: () => void deleteCheckIn({ id, goal_id: goal.id }) },
    });
  }

  async function removePhoto(completionId: string, goalId: string, media: MediaLite) {
    const { error } = await sb().from("completion_media").delete().eq("id", media.id);
    if (error) {
      toast("Couldn't remove the photo.", { tone: "error" });
      return;
    }
    void removePhotos([media.storage_path]);
    refreshMemories(qc, coupleId, goalId);
  }

  // ── Goals ──

  interface GoalInput {
    title: string;
    cadence: Cadence;
    cadence_target: number;
    shared: boolean;
    is_joint: boolean;
  }
  interface ReminderInput { enabled: boolean; hour: number; minute: number; day_of_week: number | null }

  async function saveReminder(goalId: string, cadence: Cadence, r: ReminderInput) {
    if (cadence === "once" || !r.enabled) {
      await sb().from("goal_reminders").delete().eq("goal_id", goalId).eq("user_id", userId);
    } else {
      await sb().from("goal_reminders").upsert(
        {
          goal_id: goalId,
          user_id: userId,
          enabled: true,
          hour: r.hour,
          minute: r.minute,
          day_of_week: cadence === "weekly" ? r.day_of_week : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        { onConflict: "goal_id,user_id" }
      );
    }
    qc.invalidateQueries({ queryKey: qk.reminder(goalId, userId) });
  }

  /** Creates a goal optimistically; returns its id immediately. */
  function createGoal(input: GoalInput, reminder: ReminderInput): string {
    const id = crypto.randomUUID();
    const row = {
      id,
      couple_id: coupleId,
      owner_id: input.shared ? null : userId,
      is_joint: input.shared ? input.is_joint : false,
      title: input.title.trim(),
      description: null,
      cadence: input.cadence,
      cadence_target: input.cadence === "once" ? 1 : input.cadence_target,
      emoji: "🎯",
      color: "#374151",
      starts_on: new Date().toISOString().split("T")[0],
      ends_on: null,
      archived_at: null,
      created_at: new Date().toISOString(),
    };
    const rollback = patchGoals(qc, coupleId, (goals) => [{ ...row, completions: [] }, ...goals]);
    void (async () => {
      const { error } = await sb().from("goals").insert({ ...row, created_at: undefined });
      if (error) {
        rollback();
        toast("Couldn't create that goal. Try again.", { tone: "error" });
        return;
      }
      if (reminder.enabled) await saveReminder(id, input.cadence, reminder);
    })();
    return id;
  }

  async function updateGoal(goalId: string, input: GoalInput, reminder: ReminderInput) {
    const patch = {
      title: input.title.trim(),
      cadence: input.cadence,
      cadence_target: input.cadence === "once" ? 1 : input.cadence_target,
      owner_id: input.shared ? null : userId,
      is_joint: input.shared ? input.is_joint : false,
    };
    const rollback = patchGoals(qc, coupleId, (goals) => goals.map((g) => (g.id === goalId ? { ...g, ...patch } : g)));
    const { error } = await sb().from("goals").update(patch).eq("id", goalId);
    if (error) {
      rollback();
      toast("Couldn't save changes.", { tone: "error" });
      return false;
    }
    await saveReminder(goalId, input.cadence, reminder);
    return true;
  }

  async function archiveGoal(goal: GoalWithCompletions) {
    const rollback = patchGoals(qc, coupleId, (goals) => goals.filter((g) => g.id !== goal.id));
    const { error } = await sb().from("goals").update({ archived_at: new Date().toISOString() }).eq("id", goal.id);
    if (error) {
      rollback();
      toast("Couldn't archive that goal.", { tone: "error" });
      return;
    }
    toast(`Archived “${goal.title}”`, {
      action: {
        label: "Undo",
        onClick: async () => {
          patchGoals(qc, coupleId, (goals) => [goal, ...goals.filter((g) => g.id !== goal.id)]);
          await sb().from("goals").update({ archived_at: null }).eq("id", goal.id);
          qc.invalidateQueries({ queryKey: qk.goals(coupleId) });
        },
      },
    });
  }

  async function deleteGoal(goal: GoalWithCompletions) {
    // Collect photo paths before the cascade removes the media rows.
    const { data: media } = await sb()
      .from("completion_media")
      .select("storage_path, completions!inner(goal_id)")
      .eq("completions.goal_id", goal.id);
    const rollback = patchGoals(qc, coupleId, (goals) => goals.filter((g) => g.id !== goal.id));
    const { error } = await sb().from("goals").delete().eq("id", goal.id);
    if (error) {
      rollback();
      toast("Couldn't delete that goal.", { tone: "error" });
      return false;
    }
    void removePhotos((media ?? []).map((m) => m.storage_path as string));
    qc.removeQueries({ queryKey: qk.goalHistory(goal.id) });
    qc.invalidateQueries({ queryKey: qk.journal(coupleId) });
    return true;
  }

  // ── Dreams ──

  function patchDreams(fn: (d: DreamRow[]) => DreamRow[]) {
    const key = qk.dreams(coupleId);
    const prev = qc.getQueryData<DreamRow[]>(key);
    if (prev) qc.setQueryData(key, fn(prev));
    return () => qc.setQueryData(key, prev);
  }

  function createDream(input: { title: string; note: string; shared: boolean }) {
    const row: DreamRow = {
      id: crypto.randomUUID(),
      couple_id: coupleId,
      owner_id: input.shared ? null : userId,
      title: input.title.trim(),
      note: input.note.trim() || null,
      emoji: "✨",
      achieved_at: null,
      created_at: new Date().toISOString(),
    };
    const rollback = patchDreams((d) => [row, ...d]);
    void (async () => {
      const { error } = await sb().from("dreams").insert({
        id: row.id, couple_id: row.couple_id, owner_id: row.owner_id, title: row.title, note: row.note, emoji: row.emoji,
      });
      if (error) {
        rollback();
        toast("Couldn't add that dream.", { tone: "error" });
      }
    })();
  }

  async function updateDream(dreamId: string, patch: Partial<DreamRow>) {
    const rollback = patchDreams((d) => d.map((x) => (x.id === dreamId ? { ...x, ...patch } : x)));
    const { error } = await sb().from("dreams").update(patch).eq("id", dreamId);
    if (error) {
      rollback();
      toast("Couldn't save changes.", { tone: "error" });
      return false;
    }
    return true;
  }

  async function deleteDream(dream: DreamRow) {
    const rollback = patchDreams((d) => d.filter((x) => x.id !== dream.id));
    const { error } = await sb().from("dreams").delete().eq("id", dream.id);
    if (error) {
      rollback();
      toast("Couldn't delete that dream.", { tone: "error" });
      return;
    }
    void removePhotos([dream.achieved_photo_path]);
  }

  /** Marks a dream achieved, optionally with a photo + note for the journal. */
  async function achieveDream(dream: DreamRow, opts: { note?: string; photo?: Blob | null }) {
    const achieved_at = new Date().toISOString();
    const base = { achieved_at, achieved_note: opts.note?.trim() || null, achieved_by: userId };
    const rollback = patchDreams((d) => d.map((x) => (x.id === dream.id ? { ...x, ...base } : x)));

    let { error } = await sb().from("dreams").update(base).eq("id", dream.id);
    if (error && /column/i.test(error.message)) {
      // Migration 0010 not applied yet — save the essentials.
      ({ error } = await sb().from("dreams").update({ achieved_at }).eq("id", dream.id));
    }
    if (error) {
      rollback();
      toast("Couldn't save that. Try again.", { tone: "error" });
      return;
    }
    qc.invalidateQueries({ queryKey: qk.journal(coupleId) });
    if (partner) {
      void notifyPartner("A dream came true ✨", `${selfName} marked “${dream.title}” as achieved`, `/journal?dream=${dream.id}`);
    }

    if (opts.photo) {
      setUploading(dream.id, true);
      try {
        const img = await prepareImage(opts.photo);
        const path = await uploadPhoto(img, "dreams", coupleId, userId, dream.id);
        const photo = {
          achieved_photo_path: path,
          achieved_photo_width: img.width || null,
          achieved_photo_height: img.height || null,
        };
        const { error: photoErr } = await sb().from("dreams").update(photo).eq("id", dream.id);
        if (photoErr) {
          await removePhotos([path]);
          throw photoErr;
        }
        patchDreams((d) => d.map((x) => (x.id === dream.id ? { ...x, ...photo } : x)));
      } catch (err) {
        console.error("Dream photo upload failed:", err);
        toast("Couldn't save the photo.", { tone: "error" });
      } finally {
        setUploading(dream.id, false);
      }
    }
  }

  async function reopenDream(dream: DreamRow) {
    const cleared = {
      achieved_at: null,
      achieved_note: null,
      achieved_photo_path: null,
      achieved_photo_width: null,
      achieved_photo_height: null,
      achieved_by: null,
    };
    const rollback = patchDreams((d) => d.map((x) => (x.id === dream.id ? { ...x, ...cleared } : x)));
    let { error } = await sb().from("dreams").update(cleared).eq("id", dream.id);
    if (error && /column/i.test(error.message)) {
      ({ error } = await sb().from("dreams").update({ achieved_at: null }).eq("id", dream.id));
    }
    if (error) {
      rollback();
      toast("Couldn't update that dream.", { tone: "error" });
      return;
    }
    void removePhotos([dream.achieved_photo_path]);
    qc.invalidateQueries({ queryKey: qk.journal(coupleId) });
  }

  return {
    logCheckIn,
    quickCheckIn,
    deleteCheckIn,
    attachPhoto,
    removePhoto,
    createGoal,
    updateGoal,
    archiveGoal,
    deleteGoal,
    createDream,
    updateDream,
    deleteDream,
    achieveDream,
    reopenDream,
  };
}
