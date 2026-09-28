@AGENTS.md

# CheckMate — Couples Goal Tracker

## What this app is

A PWA for two people (a couple) to set goals together, prove they completed them with photo check-ins, and build a shared photo memory journal over time. Think habit tracker meets shared diary.

Examples of goals:
- "Work out 3x this week" (weekly, individual or shared)
- "Cook for each other" (weekly, shared)
- "Move in together" (a big milestone — usually a *dream*)

The two people pair up via an invite code (e.g. `ROSE-774213`) or a `/join/<code>` link. Once paired, they see each other's goals and check-ins in real time.

## Tech stack

- **Next.js 16** (App Router, TypeScript) — PWA, installable on iPhone via "Add to Home Screen"
- **Tailwind CSS v4** — `@import "tailwindcss"`; design tokens are theme colors (see Conventions)
- **Supabase** — auth (OTP email), Postgres, private Storage bucket (photos), Realtime, Edge Functions (push + reminders, pg_cron)
- **TanStack Query** — all reads/writes, cache persisted to localStorage
- **date-fns** — period windows; **week starts on Sunday** (`weekStartsOn: 0`) throughout

## Design

The app uses the **Linen / CheckMate** design system:

- **Fonts**: Instrument Serif italic for headings, DM Sans for body, Caveat (+ Amatic SC for Hebrew) as the journal's handwriting (`.font-hand`)
- **Colors** (CSS custom properties in `globals.css`, exposed as Tailwind theme colors):
  - `primary` / `primary-light` — warm terracotta (`#C4704F`)
  - `partner-accent` / `partner-light` — muted blue (`#4A7A9B`)
  - `success` / `success-light` — green
  - `background`, `surface`, `surface-alt`, `border`, `foreground`, `muted`
- **Goal color chips**: each goal has a `color` field (hex string). UI uses 11×11px rounded squares (not emoji) as the visual anchor
- **Dots**: filled/empty circles showing progress (max 8 dots, then `count/target` text) — `components/ui/bits.tsx`
- **Section dividers**: `10px bold uppercase muted` label + count badge + horizontal rule — `SectionDivider` in `bits.tsx`
- **Journal**: scrapbook on paper texture — polaroids, label-maker prints, index cards, sticky notes, ink stamps, washi tape; every entry gets a stable pseudo-random tilt/tape/variant from its id (`utils/seeded.ts`). Achieved dreams render as full-width "Dream achieved" spreads
- No emoji in UI chrome; no `alert()`/`confirm()` — use `toast()` / `confirmSheet()`

## Pages

| Route | What it does |
|---|---|
| `/welcome` | OTP email sign-in |
| `/onboard` | Set display name, then create a couple (share invite link) or join one (code prefilled from a `/join` link) |
| `/join/[code]` | Public invite link — remembers the code, routes through sign-in to the join step |
| `/home` | Daily briefing: this-week score card, your goals (tap + to check in, hold + to log instantly), partner's week, shared dreams |
| `/goals` | Sections Yours / Together / [Partner's] / Done ✓ — color chip, cadence, Dots, streak |
| `/goals/new`, `/goals/[id]/edit` | Goal form (`components/goal-form.tsx`): title, cadence, target, shared + joint/separate, personal reminder |
| `/goals/[id]` | Goal detail: progress + streak calendar, check-in / nudge, history grouped by period, per-check-in actions sheet |
| `/check-in/[goalId]` | Log a check-in: optional photo + note, backdate up to 7 days; success screen shows progress then returns |
| `/dreams` | Bucket list: Active / Achieved. Achieving opens a sheet for a photo + note → journal spread + confetti |
| `/dreams/new`, `/dreams/[id]/edit` | Dream form (`components/dream-form.tsx`) |
| `/journal` | Scrapbook of check-ins + achieved dreams, grouped by month, person filter, infinite scroll, full-screen swipeable lightbox (`?open=<completionId>`, `?dream=<id>`) |
| `/profile` | Display name, partner / invite sharing, push toggle (per device), sign out |

## Key files

```
src/
├── app/
│   ├── (app)/                  # Authenticated pages — BottomNav + AppDataProvider. All static/SSG (prefetchable)
│   │   ├── goals/[id]/         # page.tsx (server, generateStaticParams → []) + goal-detail.tsx (client)
│   │   ├── check-in/[goalId]/  # same split: page.tsx + check-in.tsx
│   │   └── …
│   ├── join/[code]/            # invite links
│   ├── welcome/, onboard/, auth/callback/
│   └── globals.css             # tokens, paper textures, animations
├── contexts/app-data.tsx       # AppDataProvider: session → couple → goals queries + the realtime channel
├── lib/
│   ├── queries.ts              # Query keys (qk) + every fetcher
│   ├── actions.ts              # useActions(): all writes — optimistic cache update → Supabase → rollback + toast
│   ├── query-client.ts         # QueryClient defaults + localStorage persister
│   ├── photo-urls.ts           # Signed-URL cache (persisted, batched) + useSignedUrl()
│   └── supabase/{client,server}.ts
├── hooks/                      # use-auth (session query + signOut), use-goal, use-dreams, use-push
├── components/
│   ├── ui/bits.tsx             # SectionDivider, Dots, Avatar, Toggle, BackButton, PageTitle, getInitial/firstName
│   ├── ui/feedback.tsx         # toast(), confirmSheet(), FeedbackHost
│   ├── ui/sheet.tsx            # Bottom sheet
│   ├── ui/photo.tsx            # Private photo <img> (thumb → full fallback, re-sign on error)
│   ├── ui/celebrate.tsx        # Confetti burst
│   ├── check-in-button.tsx     # "+" — tap to check in, hold to quick-log with Undo
│   ├── journal/scrapbook.tsx   # Journal layout + card variants + dream spread
│   └── journal/lightbox.tsx    # Full-screen viewer
├── proxy.ts                    # Route protection (Next 16 "middleware"): unauthed → /welcome
├── utils/
│   ├── period.ts               # getPeriodRange(), countCompletionsInPeriod(), streaks — weekStartsOn: 0
│   ├── goal-progress.ts        # goalProgress(): the ONE place that decides counts/done for personal/joint/separate goals
│   ├── storage.ts              # uploadPhoto(), removePhotos(), thumbPath(), signed URLs
│   ├── image.ts                # prepareImage(): one decode → 1200px + 600px thumb + dimensions
│   ├── invite.ts               # codes, shareInvite(), pending invite from /join links
│   └── seeded.ts               # deterministic PRNG per id (journal randomness)
└── types/database.ts           # Table types; GoalWithCompletions, CompletionLite, JournalCompletion…
public/sw.js                    # Service worker: push, photo cache (by path, ignoring token), /_next/static cache (prod)
public/manifest.json            # PWA manifest (+ shortcuts)
supabase/migrations/            # 0001…0011 — see Supabase setup
supabase/functions/send-push/   # Push to partner (JWT) or any user (service role); all devices; prunes dead subs
supabase/functions/send-reminders/ # pg_cron every 30 min; per-user timezone periods
```

## Data model

```
users              — mirrors auth.users; display_name, push_token (legacy single device)
push_subscriptions — one row per device (endpoint unique)
couples            — one row per couple
couple_members     — joins users to couples (max 2, enforced by trigger)
couple_invites     — code, 7-day expiry, one-time use
goals              — owner_id IS NULL = shared; cadence (daily/weekly/monthly/yearly/once), cadence_target, is_joint, color
completions        — one row per check-in (goal_id, user_id, note, completed_at)
completion_media   — photo per completion (storage_path, width, height); thumbnail at thumbPath(path)
goal_reminders     — per user per goal: hour/minute/day_of_week/timezone
dreams             — owner_id IS NULL = shared; achieved_at + achieved_note/photo_path/photo dims/achieved_by
```

Key design decisions:
- `owner_id IS NULL` means shared — no separate flag
- `is_joint`: `true` = both people's check-ins add to one total; `false` = each person tracks independently. Always go through `goalProgress()` — never re-derive counts in a page
- RLS via `is_couple_member(couple_id)`; storage paths are `<kind>/<coupleId>/<userId>/<entityId>/<ts>.jpg` and policies authorize on the couple id segment
- Media bucket is private — render photos with `<Photo path=… />`, never build URLs by hand
- Week starts on **Sunday**

## Conventions in this codebase

- **Tailwind v4 tokens**: use theme colors — `bg-surface`, `text-muted`, `border-border`, `bg-primary`. Never `bg-[--primary]`: in v4 that compiles to `background-color: --primary` (invalid, silently dropped). For non-color vars use `(--var)` syntax, e.g. `bg-(--nav-bg)`. In inline styles use `var(--primary)`
- **Data**: read with `useQuery` using keys/fetchers from `lib/queries.ts`; write through `useActions()` in `lib/actions.ts` (optimistic). Don't call `supabase.from(...)` for reads inside components
- `useAppData()` gives `{ user, couple, self, partner, goals, loading, goalsLoading, refetch }` in `(app)/` routes; `useDreams(couple?.id)`, `useGoal(id)`, `useGoalHistory(id)` for the rest
- Realtime is one channel in `AppDataProvider`; it patches/invalidates the query cache. New tables must be added to the `supabase_realtime` publication (see 0010)
- Dynamic routes under `(app)` are split into a server `page.tsx` (with `generateStaticParams() { return [] }`) and a client component, so they're static-on-demand and prefetchable. Avoid `force-dynamic`
- Loading states only when there's no cached data at all (`isPending`); never block a page on a background refetch
- `goal.color` is a hex string — inline styles, not Tailwind classes
- Text a user typed gets `dir="auto"` (Hebrew/English)
- Inputs use `text-[16px]` so iOS doesn't zoom on focus

## Setup

```bash
git clone https://github.com/aLevonai/keeping_accountable
cd keeping_accountable
npm install
cp .env.local.example .env.local   # Supabase URL + anon key, NEXT_PUBLIC_VAPID_PUBLIC_KEY
npm run dev
```

**Supabase (one-time):**
1. Run migrations in order `0001` → `0011`
2. Enable the Email provider (OTP)
3. Deploy Edge Functions `send-push` and `send-reminders`; set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
4. Store the service-role key in Vault as `service_role_key` (used by the reminders cron in 0006)

## What's NOT done yet

These are intentionally deferred — don't add them unless asked:

- **Couple streaks** — per-goal streaks exist; a "both hit everything" couple streak doesn't
- **Reactions** — reactions on journal check-ins
- **Goal color picker** — color defaults to `#374151`; picker UI not yet built
- **Offline check-ins** — photos and static assets are cached, but writes need a connection
- **Grid layout for Goals** — 2-column ring layout exists in the design prototype but not in code
- **"Your move" / match framing** — game-like weekly match concept
