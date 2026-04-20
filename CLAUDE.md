@AGENTS.md

# Together — Couples Goal Tracker

A PWA for two people to set shared and individual goals, check in with photo proof, and build a shared memory journal.

## What's built

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind · Supabase (auth, Postgres, storage, realtime)

**Pages:**
- `/welcome` — email magic link sign-in
- `/onboard` — set display name + create or join a couple via invite code (e.g. `ROSE-7742`)
- `/home` — habit-tracker style dashboard: one row per goal, Mon–Sun dots for weekly goals, `+` to check in
- `/goals` — full goals list with filter pills (all / mine / shared / partner)
- `/goals/new` — create a goal: title, cadence (weekly/monthly/yearly/once), target count, shared toggle
- `/goals/[id]` — goal detail with progress, check-in button, full photo history
- `/check-in/[goalId]` — log a check-in: optional photo + optional note
- `/journal` — chronological feed of all check-ins from both partners with photos
- `/profile` — edit name, see partner/invite code status, sign out

**Key files:**
- `src/hooks/use-couple.ts` — loads couple + partner context used everywhere in the app
- `src/hooks/use-goals.ts` — goals with real-time Supabase subscription on completions
- `src/utils/period.ts` — weekly/monthly/yearly window calculations for progress tracking
- `src/utils/storage.ts` — photo upload/URL helpers for Supabase Storage
- `src/middleware.ts` — route protection (unauthenticated → `/welcome`, logged in + no couple → `/onboard`)
- `supabase/migrations/` — 3 SQL files: schema, RLS policies, storage bucket

**Data model summary:**
- `users` — mirrors auth.users, has display_name
- `couples` + `couple_members` — links exactly 2 users; `is_couple_member()` RLS helper used everywhere
- `couple_invites` — short invite codes with 7-day expiry
- `goals` — `owner_id IS NULL` = shared goal, `owner_id = user` = individual
- `completions` + `completion_media` — one completion per check-in, optional photo path in storage

## Setup (after cloning)

1. Create a Supabase project at supabase.com
2. Run the 3 migration files in `supabase/migrations/` via the Supabase SQL Editor, in order
3. Copy `.env.local.example` → `.env.local` and fill in your project URL + anon key
4. `npm install && npm run dev`

## What's intentionally NOT done yet (design phase)

- No custom emoji/color on goals (defaults: 🎯 / #374151) — design pass comes later
- No push notifications
- No streaks
- No reactions on check-ins
- Styling is functional/minimal — a design pass is planned once core flow is tested
