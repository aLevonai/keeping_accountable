# Design Handoff: Together — App Redesign (Linen Theme)

## Overview

This is a full redesign of the "Together" couples goal tracker PWA. The design has been approved by the product owner and is ready for implementation. All screens have been redesigned: Home, Goals, Journal, Check-in, and Profile.

## About the Design Files

The file `Together Redesign.html` is a **design reference prototype built in HTML/React**. It is not production code — do not copy it directly into the Next.js codebase. Your task is to **recreate these designs inside the existing Next.js + Tailwind app** at `src/app/(app)/`, following all existing patterns (App Router, `useAuth`, `useCouple`, `useGoals`, Supabase, etc.).

The prototype includes three theme variants (Linen, Sage, Dusk). **Implement the Linen theme only.**

## Fidelity

**High-fidelity.** The prototype is pixel-accurate in terms of colors, typography, spacing, and component structure. Recreate it faithfully using Tailwind utility classes and the existing component patterns.

---

## Design Tokens — Linen Theme

Apply these as CSS custom properties in `src/app/globals.css`, replacing the existing `:root` block:

```css
:root {
  --background: #F8F4F0;
  --surface: #FFFFFF;
  --surface-alt: #F2EDE8;
  --foreground: #1C1713;
  --muted: #9C8B7E;
  --border: #E8E0D8;
  --primary: #C4704F;        /* accent — terracotta */
  --primary-light: #F5EAE4;
  --success: #5A8A6A;
  --success-light: #E8F2EC;
  --nav-bg: rgba(248,244,240,0.94);
}
```

### Typography

Two font families. Add both to `layout.tsx` via Google Fonts:

| Role | Family | Weights |
|---|---|---|
| Display (headings) | Instrument Serif | 400 italic |
| Body / UI | DM Sans | 300, 400, 500, 600 |

**Usage rule:** Page titles (`h1`) use `font-instrument-serif italic`. All other text uses DM Sans.

### Spacing & Radius

| Token | Value |
|---|---|
| Page horizontal padding | `px-5` (20px) |
| Page top padding | `pt-4` (16px) |
| Card border radius | `rounded-2xl` (14px) |
| Large card radius | `rounded-2xl` (16px) |
| Pill radius | `rounded-full` |
| Bottom nav padding-bottom | `pb-4` + safe-area |

---

## Screens

### 1. Home (`/home`)

**Purpose:** Daily habit-tracker dashboard. Shows the couple's combined progress and per-person goal status.

**Layout (top → bottom):**

1. **Header block** (`px-5 pt-4 pb-3`)
   - Tiny date line: `text-[11px] font-medium uppercase tracking-[0.07em] text-[--muted]`
   - Couple name heading: `font-instrument-serif italic text-[26px] text-[--foreground]` — e.g. "Alex & Jordan"

2. **Partner split card** (`mx-4 mb-5 bg-[--surface] rounded-2xl border border-[--border] overflow-hidden`)
   - Two equal columns divided by a vertical border
   - Each column (`p-3.5`): Avatar (28px circle, initials, accent-tinted bg) + name label (`text-[13px] font-semibold`) + large check-in count (`text-[28px] font-light`) + "this week" label
   - Bottom strip (`bg-[--surface-alt] px-4 py-2`): "Together" label + thin progress bar (4px tall, accent fill) + "X/Y goals" count

3. **Shared goals section** — label `SHARED` in `text-[11px] font-semibold uppercase tracking-[0.08em] text-[--muted]`
   - Each shared goal row (`py-3 border-b border-[--border]`):
     - Goal title (`text-[14px] font-medium`) + `+` check-in button (32px circle, border, right-aligned) or check icon if done
     - **Dual progress bars** — one labeled "You", one labeled partner's name
       - Label: `text-[10px] font-semibold text-[--muted] w-[22px]`
       - Bar: `h-[3px] rounded-full bg-[--border]` with fill div inside
       - Count: `text-[10px] text-[--muted] w-[20px] text-right`
     - Your bar uses `--primary` (or `--success` if done); partner bar uses `--border` (dimmed, read-only)

4. **You section** — same structure, single progress bar per goal (no partner bar)

5. **Partner section** — same structure, `opacity-75`, no `+` button, progress bar uses `--muted`

**`+` button spec:** `w-8 h-8 rounded-full border border-[--border] bg-transparent text-[--muted] text-lg` — tapping navigates to `/check-in/[goalId]`

---

### 2. Goals (`/goals`)

**Purpose:** Full goal list with filter tabs.

**Layout:**
1. Header row: italic serif `h1` "Goals" + circular `+` button (`w-9 h-9 rounded-full bg-[--primary] text-white`)
2. Filter pills row (`gap-1.5 px-5 overflow-x-auto`): "All", "Mine", "Shared", partner name
   - Active: `bg-[--primary] text-white border-[--primary]`
   - Inactive: `bg-transparent text-[--muted] border border-[--border]`
   - Pill: `px-3.5 py-1.5 rounded-full text-[13px] font-medium`
3. Goal cards (`gap-2 px-4`)

**Goal card** (`bg-[--surface] rounded-2xl border border-[--border] p-3.5`):
- Title: `text-[15px] font-medium text-[--foreground]`
- Type badge (text only, no pill background): `text-[10px] font-semibold uppercase tracking-[0.06em]`
  - Shared: `text-[--primary]`
  - Partner's: `text-[--muted]`
- **Shared goal cards** show the same dual progress bars as on the Home screen
- **Non-shared cards** show a single `GoalProgress` bar + `WeekBar` dots below
- Check icon (28px circle, `bg-[--success-light]`) or `+` button top-right

**WeekBar:** 7 dots (`w-1.5 h-1.5 rounded-full`), filled = accent color, unfilled = `--border`. Days after today at 40% opacity.

---

### 3. Journal (`/journal`)

**Purpose:** Shared photo memory feed in a polaroid/scrapbook style.

**Layout:**
- Header: serif italic "Journal" + month label (`text-[12px] text-[--muted]`)
- Two-column masonry grid (`flex gap-2.5 px-4`)
  - Left column starts at top; right column starts with `pt-6` offset (stagger effect)

**Polaroid card:**
```
bg-white rounded-sm shadow-[0_2px_8px_rgba(0,0,0,0.10),0_0_0_0.5px_rgba(0,0,0,0.06)]
p-2 pb-6   ← thick bottom padding = polaroid border
transform rotate-[-1.5deg]  ← each card gets a small random rotation (±2deg)
```
- Photo area: `w-full aspect-square bg-[muted color]` — show `<Image>` if `completion_media` exists, else a faint "no photo" placeholder
- Below photo (inside white border):
  - `text-[10px] font-semibold text-[#666] uppercase tracking-[0.05em]` → "Alex · Mon"
  - `text-[10px] text-[#999]` → goal title
  - `text-[10px] italic text-[#777] mt-1` → note if present, wrapped in quotes

**Rotation:** Assign alternating small rotations. You can use a stable per-entry value derived from the entry ID or index: e.g. `[-1.5, 1.2, -0.8, 1.8, -1.2, 0.6]` cycling.

---

### 4. Check-in (`/check-in/[goalId]`)

**Purpose:** Log a completion with optional photo + note.

**Layout (`px-5`):**
1. Back button (`← Back`, `text-[14px] text-[--muted]`)
2. Eyebrow label: `text-[11px] font-semibold uppercase tracking-[0.08em] text-[--muted]` → "Logging"
3. Goal title: serif italic `text-[22px]`
4. Photo upload area: `w-full aspect-[4/3] rounded-2xl border-[1.5px] border-dashed border-[--border] bg-[--surface]` — centered camera icon + "Add a photo" label
5. Note textarea: `border border-[--border] rounded-xl p-3 text-[14px] bg-[--surface]` — placeholder "How did it go?"
6. Submit CTA: `w-full py-4 bg-[--primary] text-white rounded-2xl text-[15px] font-semibold` → "Log check-in"

**Success state:** Replace screen with centered check icon (56px circle `bg-[--success-light]`), "Logged" in serif italic, goal title in muted, "Back to home" link.

---

### 5. Profile (`/profile`)

**Layout:**
1. Serif italic "Profile" heading
2. Avatar (72px circle, `bg-[--primary-light]`, initials in `--primary`) + display name + email — centered
3. **Partner card** (`bg-[--surface] rounded-2xl border border-[--border]`):
   - Top section: "PARTNER" eyebrow + 40px partner avatar + name + "Connected" status
   - Bottom section: "INVITE CODE" eyebrow + code in `text-[18px] font-semibold tracking-[0.12em]` + "Copy" button (`bg-[--primary-light] text-[--primary] text-[11px] font-semibold rounded-md px-2 py-1`)
4. Settings card: "Edit display name" + "Notifications" rows (chevron right, `text-[15px]`, `py-3.5`)
5. Sign out row: `text-[#C0392B]`

---

## Bottom Navigation

File: `src/components/ui/bottom-nav.tsx`

```
bg: var(--nav-bg)  →  rgba(248,244,240,0.94)
backdrop-filter: blur(12px)
border-top: 1px solid var(--border)
padding-bottom: env(safe-area-inset-bottom)
```

- Active tab: `text-[--primary]`
- Inactive tab: `text-[--muted]`
- Label: `text-[10px] font-semibold`
- Icons: use Lucide icons at `size={22}`, `strokeWidth={active ? 2.5 : 1.8}`

**No changes to the 4 tabs** (Home, Goals, Journal, Profile).

---

## Shared Goal — Data Model Note

Shared goals (`owner_id IS NULL`) now visually track **both partners independently**. The UI shows two progress bars side by side:

- **Your bar** = `countCompletionsInPeriod` filtered to `user_id = me`
- **Partner bar** = `countCompletionsInPeriod` filtered to `user_id = partner`

This requires updating `useGoals` to group completions by `user_id` so each bar can be computed separately. The existing `completions` array on each goal already contains all completions — just partition by `user_id` before counting.

---

## Interactions & Transitions

| Interaction | Behavior |
|---|---|
| `+` check-in button | `active:scale-95 transition-transform duration-150` |
| Filter pills | `transition-colors duration-150` |
| Goal cards | `active:scale-[0.98] transition-transform duration-150` |
| Tab switch | Instant (no animation) |
| Check-in success | Fade in — `transition-opacity duration-300` |
| Progress bars | `transition-[width] duration-300 ease-out` on initial render |

---

## Removed from Old Design

These elements from the previous design should be **removed entirely**:

- All emoji in UI chrome (🎯 🔥 💫 ✅ etc.) — the goal's own emoji field is fine if user-set, but remove all hardcoded UI emoji
- Colored blob / emoji icon on goal cards — replace with clean text-only cards
- `border-green-200` completion state on goal cards — use the subtle success bar color instead
- `animate-bounce` loading spinner
- `text-rose-500` / `violet-500` color references — replace with `--primary` / `--muted` tokens

---

## Files in This Package

| File | Description |
|---|---|
| `README.md` | This document |
| `Together Redesign.html` | Full interactive prototype (all 5 screens, Linen + 2 alt themes) |

Open `Together Redesign.html` in a browser to interact with the prototype. Use the sidebar to switch screens and themes.
