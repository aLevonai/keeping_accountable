-- Users (mirrors auth.users)
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  push_token    text,
  created_at    timestamptz not null default now()
);

-- Couples
create table public.couples (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Couple members (exactly 2 rows per couple when fully formed)
create table public.couple_members (
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (couple_id, user_id)
);

-- Invite codes for pairing
create table public.couple_invites (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  inviter_id  uuid not null references public.users(id) on delete cascade,
  code        text not null unique,
  accepted_at timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Goals
-- owner_id IS NULL  → shared goal (both partners)
-- owner_id = <uid>  → individual goal, visible to couple
create table public.goals (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references public.couples(id) on delete cascade,
  owner_id        uuid references public.users(id) on delete set null,
  title           text not null,
  description     text,
  cadence         text not null check (cadence in ('weekly','monthly','yearly','once')),
  cadence_target  integer not null default 1,
  emoji           text not null default '🎯',
  color           text not null default '#374151',
  starts_on       date not null default current_date,
  ends_on         date,
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Completions (one row per check-in)
create table public.completions (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.goals(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  note         text,
  completed_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Media attached to completions
create table public.completion_media (
  id            uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.completions(id) on delete cascade,
  storage_path  text not null,
  media_type    text not null default 'photo' check (media_type in ('photo','video')),
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);

-- Helper: check if the calling user is a member of a given couple
create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.couple_members
    where couple_id = p_couple_id
      and user_id   = auth.uid()
  );
$$;
