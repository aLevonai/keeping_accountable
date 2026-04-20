@AGENTS.md

# Together — Couples Goal Tracker

## What this app is

A PWA for two people (a couple) to set goals together, prove they completed them with photo check-ins, and build a shared photo memory journal over time. Think habit tracker meets shared diary.

Examples of goals:
- "Work out 3x this week" (weekly, individual or shared)
- "Cook for each other" (weekly, shared)
- "Move in together" (yearly, shared — a big milestone)

The two people pair up via a short invite code (e.g. `ROSE-7742`). Once paired, they see each other's goals and check-ins in real time.

## Tech stack

- **Next.js 16** (App Router, TypeScript) — deployed as a PWA, installable on iPhone via "Add to Home Screen"
- **Tailwind CSS** — styling (currently functional/minimal, design pass not done yet)
- **Supabase** — handles everything backend: auth (magic link email), Postgres DB, file storage (photos), realtime subscriptions
- **TanStack Query** — data fetching/caching
- **date-fns** — date math for period windows

## Pages

| Route | What it does |
|---|---|
| `/welcome` | Magic link email sign-in |
| `/onboard` | Set display name, then either create a couple (get invite code) or join one (enter partner's code) |
| `/home` | **Main screen.** Habit-tracker style: one row per goal, Mon–Sun dots for weekly goals, X/Y count, `+` check-in button |
| `/goals` | Full list with filter pills: All / Mine / Shared / Partner |
| `/goals/new` | Create a goal: title, cadence, target, shared toggle |
| `/goals/[id]` | Goal detail: progress, check-in button, full photo history |
| `/check-in/[goalId]` | Log a check-in: optional photo (camera or library) + optional note |
| `/journal` | Chronological feed of all check-ins from both partners with photos |
| `/profile` | Edit display name, see partner status / invite code, sign out |

## Key files

```
src/
├── app/
│   ├── (app)/              # All authenticated pages — BottomNav, force-dynamic
│   ├── welcome/            # Sign-in
│   ├── onboard/            # Couple pairing
│   └── auth/callback/      # Supabase magic link redirect handler
├── hooks/
│   ├── use-auth.ts         # Current user + signOut
│   ├── use-couple.ts       # Loads couple, self, and partner — used everywhere
│   └── use-goals.ts        # Goals + completions, real-time subscription
├── lib/supabase/
│   ├── client.ts           # Browser Supabase client (used in "use client" components)
│   └── server.ts           # Server Supabase client (used in Server Components / API routes)
├── middleware.ts            # Route protection: unauthed → /welcome, no couple → /onboard
├── utils/
│   ├── period.ts           # getPeriodRange(), countCompletionsInPeriod() — core goal logic
│   └── storage.ts          # uploadPhoto(), getPhotoUrl() — Supabase Storage helpers
└── types/database.ts       # TypeScript types for all DB tables
supabase/migrations/
├── 0001_schema.sql         # All tables + is_couple_member() RLS helper function
├── 0002_rls.sql            # Row Level Security policies for every table
└── 0003_storage.sql        # Storage bucket + policies
```

## Data model

```
users           — mirrors auth.users, has display_name
couples         — one row per couple
couple_members  — joins users to couples (exactly 2 rows per couple)
couple_invites  — short code (e.g. ROSE-7742), 7-day expiry, one-time use
goals           — owner_id IS NULL = shared goal; owner_id = uuid = individual goal
completions     — one row per check-in (who, when, note)
completion_media — photos attached to completions (storage_path in Supabase Storage)
```

Key design decision: `owner_id IS NULL` means a shared goal (both partners). There's no separate flag or type — just check `owner_id === null`.

RLS is enforced via `is_couple_member(couple_id)` — a Postgres helper function that checks if the calling user is in a given couple. All table policies use it.

## Conventions in this codebase

- All authenticated pages live under `src/app/(app)/` which sets `export const dynamic = "force-dynamic"` so they're never statically pre-rendered (they need auth context)
- Supabase client fallbacks to placeholder URLs in dev/build so TypeScript compilation doesn't fail without `.env.local`
- The `useCouple(userId)` hook is the ambient context for the whole app — always call it near the top of page components
- Period logic (what counts as "this week") lives entirely in `utils/period.ts`, not in SQL — keeps it debuggable
- No emoji/color customization on goals yet — defaults to 🎯 / #374151

## Setup

```bash
git clone https://github.com/aLevonai/keeping_accountable
cd keeping_accountable
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

**Supabase setup (one-time):**
1. Create a project at supabase.com
2. Run `supabase/migrations/0001_schema.sql`, then `0002_rls.sql`, then `0003_storage.sql` in the SQL editor
3. Enable Email provider in Authentication → Providers
4. Copy Project URL + anon key into `.env.local`

## What's NOT done yet

These are intentionally deferred — don't add them unless asked:

- **Design** — styling is functional/minimal. A proper design pass (colors, typography, animations) is planned after the core flow is tested
- **Streaks** — tracking consecutive periods
- **Push notifications** — "your partner just checked in"
- **Reactions** — emoji reactions on check-ins
- **Goal emoji/color picker** — currently hardcoded to 🎯 / #374151
- **Offline support** — no service worker caching, shows error if offline
