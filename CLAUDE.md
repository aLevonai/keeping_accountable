@AGENTS.md

# CheckMate — Couples Goal Tracker

## What this app is

A PWA for two people (a couple) to set goals together, prove they completed them with photo check-ins, and build a shared photo memory journal over time. Think habit tracker meets shared diary.

Examples of goals:
- "Work out 3x this week" (weekly, individual or shared)
- "Cook for each other" (weekly, shared)
- "Move in together" (yearly, shared — a big milestone)

The two people pair up via a short invite code (e.g. `ROSE-7742`). Once paired, they see each other's goals and check-ins in real time.

## Tech stack

- **Next.js 16** (App Router, TypeScript) — deployed as a PWA, installable on iPhone via "Add to Home Screen"
- **Tailwind CSS v4** — styling uses `@import "tailwindcss"` syntax; CSS custom properties referenced as `bg-[--variable]`
- **Supabase** — auth (magic link / OTP email), Postgres DB, file storage (photos), realtime subscriptions, Edge Functions (push notifications)
- **TanStack Query** — data fetching/caching
- **date-fns** — date math for period windows; **week starts on Sunday** (`weekStartsOn: 0`) throughout

## Design

The app uses the **Linen / CheckMate** design system:

- **Font**: Instrument Serif italic for headings, system sans for body
- **Colors** (CSS custom properties in `globals.css`):
  - `--primary` / `--primary-light` — warm terracotta (`#C4704F`)
  - `--partner-accent` / `--partner-light` — muted blue (`#4A7A9B`)
  - `--success` / `--success-light` — green
  - `--background`, `--surface`, `--border`, `--foreground`, `--muted`
- **Goal color chips**: each goal has a `color` field (hex string). UI uses 11×11px rounded squares (not emoji) as the visual anchor
- **Dots component**: filled/empty circles showing progress (max 8 dots, then `count/target` text)
- **Section dividers**: `10px bold uppercase muted` label + count badge + horizontal rule — used instead of cadence headers or filter pills
- No emoji in UI chrome

## Pages

| Route | What it does |
|---|---|
| `/welcome` | OTP email sign-in |
| `/onboard` | Set display name, then create a couple (get invite code) or join one (enter partner's code) |
| `/home` | **Daily briefing**: score card with relative progress bars (you vs. partner), "Up next for you", "[Partner] this week", shared dreams horizontal scroll |
| `/goals` | Focus layout: section dividers Yours / Together / [Partner's] / Done ✓. Each card has color chip, inline cadence label, Dots progress |
| `/goals/new` | Create a goal: title, cadence, target, shared toggle, color picker |
| `/goals/[id]` | Goal detail: progress, check-in button, full photo history |
| `/goals/[id]/edit` | Edit an existing goal |
| `/check-in/[goalId]` | Log a check-in: 48px color chip header, optional photo + note, colored submit button |
| `/dreams` | Bucket list: Together / Yours / [Partner's] sections within Active / Achieved tabs. Color dots instead of emoji |
| `/dreams/new` | Create a dream (shared or personal) |
| `/dreams/[id]/edit` | Edit a dream |
| `/journal` | Polaroid scrapbook: staggered two-column grid, tape strips, varied aspect ratios (square/wide/tall), gradient backgrounds |
| `/profile` | Edit display name, partner status / invite code, push notification toggle, sign out |

## Key files

```
src/
├── app/
│   ├── (app)/              # All authenticated pages — BottomNav, force-dynamic
│   │   ├── home/           # Daily briefing screen
│   │   ├── goals/          # Goals focus layout
│   │   ├── dreams/         # Bucket list
│   │   ├── journal/        # Polaroid feed
│   │   └── profile/        # User settings
│   ├── welcome/            # OTP sign-in
│   ├── onboard/            # Couple pairing
│   └── auth/callback/      # Supabase magic link redirect handler
├── contexts/
│   └── app-data.tsx        # AppDataProvider — wraps useCouple + useGoals, used by all (app) pages
├── hooks/
│   ├── use-auth.ts         # Current user + signOut
│   ├── use-couple.ts       # Loads couple, self, partner — CoupleContext type
│   ├── use-goals.ts        # Goals + completions, real-time subscription; exports GoalWithCompletions
│   ├── use-dreams.ts       # Dreams, real-time subscription
│   └── use-push.ts         # Push notification token registration
├── components/
│   ├── app-shell.tsx       # Root shell with AppDataProvider
│   ├── ui/bottom-nav.tsx   # 5-tab nav: Home, Goals, Dreams, Journal, Profile
│   ├── ui/logo.tsx         # AppLogo component (dual-check SVG)
│   ├── ui/page-skeleton.tsx # Loading skeletons per page
│   └── ui/progress-ring.tsx # Circular progress ring
├── lib/supabase/
│   ├── client.ts           # Browser Supabase client ("use client" components)
│   └── server.ts           # Server Supabase client (Server Components / API routes)
├── middleware.ts            # Route protection: unauthed → /welcome, no couple → /onboard
├── utils/
│   ├── period.ts           # getPeriodRange(), countCompletionsInPeriod() — weekStartsOn: 0 (Sunday)
│   ├── storage.ts          # uploadPhoto(), getPhotoUrl() — Supabase Storage helpers
│   └── cn.ts               # clsx/tailwind-merge helper
└── types/database.ts       # TypeScript types for all DB tables; Cadence = "weekly"|"monthly"|"yearly"|"once"
supabase/migrations/
├── 0001_schema.sql         # All tables + is_couple_member() RLS helper function
├── 0002_rls.sql            # Row Level Security policies for every table
├── 0003_storage.sql        # Storage bucket + policies
└── 0004_dreams.sql         # Dreams table
supabase/functions/
└── send-push/              # Edge Function for push notifications
public/
├── manifest.webmanifest    # PWA manifest (name: CheckMate)
└── icons/                  # PWA icons (dual-check logo, option A)
```

## Data model

```
users           — mirrors auth.users; has display_name, push_token
couples         — one row per couple
couple_members  — joins users to couples (exactly 2 rows per couple)
couple_invites  — short code (e.g. ROSE-7742), 7-day expiry, one-time use
goals           — owner_id IS NULL = shared goal; owner_id = uuid = individual
                  has: cadence, cadence_target, is_joint, color (hex), emoji
completions     — one row per check-in (goal_id, user_id, note, completed_at)
completion_media — photos attached to completions (storage_path in Supabase Storage)
dreams          — owner_id IS NULL = shared; has: title, note, emoji, achieved_at
```

Key design decisions:
- `owner_id IS NULL` means a shared goal/dream — no separate flag, just check `owner_id === null`
- `is_joint` on goals: `true` = both people's check-ins count toward one shared total; `false` = each person tracks independently against the same target
- RLS enforced via `is_couple_member(couple_id)` — a Postgres helper used in all table policies
- Week starts on **Sunday** (`weekStartsOn: 0` in date-fns everywhere)

## Conventions in this codebase

- All authenticated pages live under `src/app/(app)/` — use `useAppData()` (not `useCouple` directly) to get `{ couple, self, partner, goals, goalsLoading }`
- `useAppData()` is provided by `AppDataProvider` in `app-shell.tsx` — it's always available in `(app)/` routes
- For dreams data, call `useDreams(couple?.id)` directly on the page (not in AppData provider)
- Period logic lives entirely in `utils/period.ts`, not SQL — `weekStartsOn: 0` for Israel locale
- Supabase client falls back to placeholder URLs in dev/build so TypeScript compilation doesn't fail without `.env.local`
- `GoalWithCompletions = GoalRow & { completions: CompletionRow[] }` — goals always arrive pre-joined with their completions
- `goal.color` is always a hex string (e.g. `#374151`) — use it directly in inline styles, not Tailwind classes
- CSS custom properties: use `var(--primary)` in inline styles, `bg-[--primary]` in Tailwind class strings

## Setup

```bash
git clone https://github.com/aLevonai/keeping_accountable
cd keeping_accountable/keeping_accountable
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

**Supabase setup (one-time):**
1. Create a project at supabase.com
2. Run migrations in order: `0001_schema.sql` → `0002_rls.sql` → `0003_storage.sql` → `0004_dreams.sql`
3. Enable Email provider in Authentication → Providers
4. Deploy `supabase/functions/send-push` Edge Function
5. Copy Project URL + anon key into `.env.local`

## What's NOT done yet

These are intentionally deferred — don't add them unless asked:

- **Streaks** — tracking consecutive periods where both people hit their goals
- **Reactions** — emoji reactions on journal check-ins
- **Goal color/emoji picker** — color defaults to `#374151`; picker UI not yet built
- **Offline support** — no service worker caching beyond PWA shell
- **Grid layout for Goals** — 2-column ring layout exists in the design prototype but not yet implemented in code
- **"Your move" / match framing** — game-like weekly match concept, not yet built
