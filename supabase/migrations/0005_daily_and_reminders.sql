-- Add "daily" cadence to goals
alter table public.goals
  drop constraint goals_cadence_check;
alter table public.goals
  add constraint goals_cadence_check
    check (cadence in ('daily','weekly','monthly','yearly','once'));

-- Per-user, per-goal reminder schedule
-- Reminders are personal: each partner sets their own, even on shared goals.
create table public.goal_reminders (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null references public.goals(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  enabled        boolean not null default true,
  hour           integer not null check (hour >= 0 and hour <= 23),
  minute         integer not null default 0 check (minute in (0, 30)),
  -- only set for weekly goals: 0=Sun … 6=Sat
  day_of_week    integer check (day_of_week >= 0 and day_of_week <= 6),
  -- IANA timezone, e.g. "Asia/Jerusalem"
  timezone       text not null default 'UTC',
  created_at     timestamptz not null default now(),
  unique (goal_id, user_id)
);

create index goal_reminders_enabled_idx
  on public.goal_reminders (enabled)
  where enabled = true;

alter table public.goal_reminders enable row level security;

-- Users can CRUD only their own reminders (even on shared goals)
create policy "own reminders read"
  on public.goal_reminders for select
  using (user_id = auth.uid());

create policy "own reminders insert"
  on public.goal_reminders for insert
  with check (user_id = auth.uid());

create policy "own reminders update"
  on public.goal_reminders for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own reminders delete"
  on public.goal_reminders for delete
  using (user_id = auth.uid());
