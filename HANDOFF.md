# CheckMate — Engineering Handoff

This document is a self-contained brief for a Claude Code session. It summarises all bugs, performance issues, dead code, and product improvements found in a full codebase review. Work through each section top-to-bottom; each item includes the exact file and line.

---

## 1. Bugs (ship-blocking)

### 1a. "Add photo" on existing check-in is silently broken
**File:** `src/app/(app)/goals/[id]/page.tsx:484`

`openChangePhoto("", c.id)` passes an empty string as `mediaId`. Then `handleChangePhoto` returns early because `!pendingMediaId.current` is falsy. The picker opens, user picks a photo, nothing happens.

Fix: track whether this is an *insert* (no existing media) vs an *update* (replacing existing media). When `mediaId` is `""`, call `completion_media.insert` instead of `.update`.

```ts
// current (broken)
onClick={() => openChangePhoto("", c.id)}

// fix — distinguish the two cases in handleChangePhoto:
if (!pendingMediaId.current) {
  // INSERT new media row
  await supabase.from("completion_media").insert({
    completion_id: pendingCompletionId.current,
    storage_path: newPath,
    media_type: "photo",
  });
} else {
  // UPDATE existing row
  await supabase.from("completion_media")
    .update({ storage_path: newPath })
    .eq("id", pendingMediaId.current);
}
```

### 1b. Two competing PWA manifests — wrong one served, middleware breaks the right one
**Files:** `src/app/manifest.ts`, `public/manifest.json`, `src/app/layout.tsx`, `src/middleware.ts:49`

- `manifest.ts` → generates `/manifest.webmanifest`, name **"Together"**, theme `#fffaf7`, `start_url: "/"`, 2 icons
- `public/manifest.json` → name **"CheckMate"**, theme `#C4704F`, `start_url: "/home"`, 9 icons — this is what `metadata.manifest` points to
- Middleware matcher excludes `manifest.json` but **not** `manifest.webmanifest` → unauthenticated fetch of the generated manifest redirects to `/welcome`, breaking iOS installation

Fix:
1. Delete `src/app/manifest.ts` — it's the stale, wrong one
2. Add `manifest.webmanifest` to the middleware matcher exclusion for safety:
```ts
matcher: [
  "/((?!_next/static|_next/image|favicon.ico|icons|manifest\\.json|manifest\\.webmanifest|sw\\.js|workbox-.*\\.js|apple-touch-icon\\.png).*)",
],
```

### 1c. Deleted/replaced photos leak storage forever
**Files:** `src/app/(app)/goals/[id]/page.tsx:231`, `src/app/(app)/journal/page.tsx:219`

- "Change photo" uploads new file, repoints DB path, never deletes the old storage object
- "Remove photo" and "Delete check-in" delete DB rows only
- Goal delete cascades DB rows but leaves all photos in the bucket

Fix — add storage cleanup before/after each DB operation:
```ts
// Before removing/replacing a photo:
await supabase.storage.from("media").remove([oldStoragePath]);
```

### 1d. Completion order is assumed, never guaranteed
**Files:** `src/hooks/use-goals.ts:24`, `src/app/(app)/goals/[id]/page.tsx:289`

PostgREST gives no defined order for embedded resources. The goal detail page does `.slice().reverse()` assuming ascending, but that assumption will silently break.

Fix — add explicit ordering to both queries:
```ts
// In use-goals.ts:
.select("*, completions(*)")
// →
.select("*, completions(*, completion_media(*))")
.order("completed_at", { referencedTable: "completions", ascending: true })

// In goals/[id]/page.tsx load():
.select("*, completions(*, completion_media(*))")
.order("completed_at", { referencedTable: "completions", ascending: true })
// then remove the .slice().reverse() and iterate the array as-is
```

### 1e. Goal creation swallows failures silently
**File:** `src/app/(app)/goals/new/page.tsx:54`

The insert `error` is destructured but never checked — on DB failure, the code still calls `refetch()` and `router.push("/goals")` as if it succeeded.

Fix:
```ts
const { data: created, error: createError } = await supabase.from("goals").insert({...}).select("id").single();
if (createError || !created) {
  setLoading(false);
  alert("Failed to create goal. Please try again."); // or a proper error state
  return;
}
```

### 1f. OTP form length inconsistency
**File:** `src/app/welcome/page.tsx:186`

Label says "8-digit code", input capped at 8, but submit button enables at `code.length < 6`. Determine what Supabase actually sends (6 digits by default) and make all three consistent.

### 1g. Partner join / display-name changes never propagate to live sessions
**Files:** `src/hooks/use-couple.ts`, `src/contexts/app-data.tsx`

- No realtime subscription on `couple_members` — "Waiting for partner" screen stays stale even after the partner joins
- `AppDataProvider.refetch` only reloads goals; display-name updates and couple pairing require a hard reload

Fix — add a `couple_members` channel in `useCouple`:
```ts
const channel = supabase
  .channel("couple-members-realtime")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "couple_members", filter: `couple_id=eq.${coupleId}` }, () => load())
  .subscribe();
```
And expose a `refetchCouple` from `AppDataProvider` so Profile can trigger it after a name save.

---

## 2. Performance

### 2a. Check-in submit blocks on slow work — user waits 2-4s
**File:** `src/app/(app)/check-in/[goalId]/page.tsx:47`

Current serial sequence: insert completion → upload full photo (3-5 MB iPhone file) → insert media row → await push invoke → show success.

Fix — optimistic success after completion insert, background the rest:
```ts
const { data: completion, error } = await supabase.from("completions").insert({...}).select().single();
if (error || !completion) { ... return; }

setSuccess(true); // show immediately

// fire-and-forget
(async () => {
  if (photo) {
    const path = await uploadPhoto(photo, couple.id, user.id, completion.id);
    await supabase.from("completion_media").insert({ completion_id: completion.id, storage_path: path, media_type: "photo" });
  }
  if (partner?.id && goalTitle) {
    await supabase.functions.invoke("send-push", { body: { target_user_id: partner.id, title: "CheckMate", body: `...` } }).catch(() => {});
  }
})();
```

### 2b. Journal loads 100 photos eagerly with no lazy loading
**File:** `src/app/(app)/journal/page.tsx:139`

All `<img>` tags load at render with no size hint. Add `loading="lazy"` and `decoding="async"` to every image in the journal and goal history:
```tsx
<img
  src={getPhotoUrl(photo.storage_path)}
  alt="Check-in"
  className="w-full h-full object-cover"
  loading="lazy"
  decoding="async"
/>
```
Do the same in `goals/[id]/page.tsx:465`.

### 2c. `getPhotoUrl` creates a new Supabase client per call
**File:** `src/utils/storage.ts:22`

Called for every photo on every render pass. The public URL is pure string concatenation — lift the client out:
```ts
import { createBrowserClient } from "@supabase/ssr";
const _storageClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key",
);

export function getPhotoUrl(path: string): string {
  const { data } = _storageClient.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}
```

### 2d. Missing DB indexes on every hot query
Apply this migration (save as `supabase/migrations/0008_perf_indexes.sql`):
```sql
-- FK indexes flagged by Supabase advisor
create index if not exists idx_completions_goal_id   on public.completions  (goal_id);
create index if not exists idx_completions_user_id   on public.completions  (user_id);
create index if not exists idx_completion_media_comp on public.completion_media (completion_id);
create index if not exists idx_goals_couple_id       on public.goals        (couple_id);
create index if not exists idx_goals_owner_id        on public.goals        (owner_id);
create index if not exists idx_dreams_couple_id      on public.dreams       (couple_id);
create index if not exists idx_couple_members_user   on public.couple_members (user_id);
create index if not exists idx_couple_invites_couple on public.couple_invites (couple_id);

-- Composite for period filtering (the hot path in countCompletionsInPeriod)
create index if not exists idx_completions_goal_date on public.completions (goal_id, completed_at);
```

### 2e. `URL.createObjectURL` in check-in preview is never revoked
**File:** `src/app/(app)/check-in/[goalId]/page.tsx:44`

```ts
// Add cleanup:
useEffect(() => {
  return () => { if (preview) URL.revokeObjectURL(preview); };
}, [preview]);
```

### 2f. Multiple pages re-instantiate `useCouple` instead of consuming `useAppData`
**Files:** `src/app/(app)/check-in/[goalId]/page.tsx:15`, `src/app/(app)/journal/page.tsx:194`, `src/app/(app)/goals/[id]/page.tsx:150`

All three call `useCouple(user?.id)` directly, running 3 extra waterfall DB queries per page mount. Switch to `useAppData()` — the data is already loaded.

```ts
// Before (check-in page):
const { user } = useAuth();
const { couple, self, partner } = useCouple(user?.id);

// After:
const { couple, self, partner } = useAppData();
// remove useAuth import unless needed for something else
```

### 2g. Service worker never caches photos — journal revisits re-download everything
**File:** `next.config.ts`

Add runtime caching for the Supabase storage domain in the PWA config:
```ts
const withPWA = withPWAInit({
  dest: "public",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*$/,
        handler: "CacheFirst",
        options: {
          cacheName: "supabase-media",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
  // ... rest unchanged
});
```

---

## 3. Dead code — safe to delete

| File | Why |
|---|---|
| `src/components/goal-card.tsx` | Zero imports in the codebase; uses old design (emoji blob, violet/stone colors) |
| `src/components/ui/progress-ring.tsx` | Only used by `goal-card.tsx` |
| The `goals.emoji` column default `'🎯'` | Design banned emoji; nothing renders it except the dead card; picker is deferred |
| `@tanstack/react-query-devtools` in `package.json` | Imported nowhere |
| `next-themes` in `package.json` | Imported nowhere; no dark-mode CSS in `globals.css` |

After deleting `goal-card.tsx` and `progress-ring.tsx`, also remove them from the key files list in `CLAUDE.md`.

Also extract the invite-code generator into a shared util — it's copy-pasted identically in `src/app/onboard/page.tsx:12` and `src/app/(app)/profile/page.tsx:68`, and both write the year-2099 expiry while the UI claims "7 days".

---

## 4. UX / Product polish

### 4a. Replace `alert()` / `confirm()` with in-app dialogs
**Occurrences:** `goals/[id]/page.tsx:215`, `journal/page.tsx:223`, `profile/page.tsx:84`

In an installed iOS PWA these render as system dialogs with the origin URL visible — the single biggest "this is a website" tell in an otherwise native-feeling app. Build a minimal bottom-sheet confirmation component and replace all three call-sites.

### 4b. Check-in success screen dead-ends
**File:** `src/app/(app)/check-in/[goalId]/page.tsx:99`

Only offers "← Back to goals". Auto-redirect after ~1.5 seconds to `/goals`, or show this-period progress for the goal + the partner's count right there ("2/3 this week · Sam is at 1/3") before redirecting.

### 4c. Journal month header is misleading
**File:** `src/app/(app)/journal/page.tsx:233`

Shows the month of the newest entry while entries below span many months. Group entries by month with section dividers (the existing pattern from the goals page) rather than a single stale header.

### 4d. Add PWA shortcuts to manifest
**File:** `public/manifest.json`

Long-press on the home-screen icon should offer shortcuts. Add to the manifest:
```json
"shortcuts": [
  { "name": "Check In", "url": "/goals", "description": "Log a check-in" },
  { "name": "Journal", "url": "/journal", "description": "See your memories" }
]
```

### 4e. Pull-to-refresh only refreshes goals regardless of current page
**File:** `src/components/app-shell.tsx`

`AppShell` calls `refetch` which only reloads goals. On Journal and Dreams pages this animates but does nothing. Either pass a per-page refetch handler via context/prop, or wait until React Query is adopted and replace with `queryClient.invalidateQueries()`.

---

## Suggested execution order

1. `manifest.ts` delete + middleware matcher fix (4b) — install-breaking today
2. Bugs 1a, 1e, 1f — user-visible failures
3. Perf 2a (optimistic check-in) + 2b (lazy images) — biggest felt improvement
4. Bug 1d (completion ordering) — silent correctness issue
5. Bug 1g (realtime couple propagation) — emotional peak of the app
6. Bug 1c (storage leaks) — long-term correctness
7. Dead code sweep (section 3)
8. DB indexes migration (2d) — apply via Supabase dashboard or CLI
9. UX polish (section 4)
10. Perf 2c, 2e, 2f, 2g — further refinement
