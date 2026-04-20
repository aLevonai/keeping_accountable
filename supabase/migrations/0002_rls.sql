-- Enable RLS on all tables
alter table public.users          enable row level security;
alter table public.couples        enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invites enable row level security;
alter table public.goals          enable row level security;
alter table public.completions    enable row level security;
alter table public.completion_media enable row level security;

-- users: read/write own row only
create policy "users_own" on public.users
  for all using (id = auth.uid());

-- Also allow partners to read each other's user row
create policy "users_partner_read" on public.users
  for select using (
    exists (
      select 1 from public.couple_members cm1
      join public.couple_members cm2 on cm1.couple_id = cm2.couple_id
      where cm1.user_id = auth.uid()
        and cm2.user_id = public.users.id
    )
  );

-- couples: readable if you're a member
create policy "couples_member_read" on public.couples
  for select using (is_couple_member(id));

create policy "couples_insert" on public.couples
  for insert with check (true); -- auth callback creates couple before adding member

-- couple_members: readable if in same couple; insert own row
create policy "couple_members_read" on public.couple_members
  for select using (is_couple_member(couple_id));

create policy "couple_members_insert" on public.couple_members
  for insert with check (user_id = auth.uid());

-- couple_invites: readable/insertable if you're in that couple
create policy "couple_invites_read" on public.couple_invites
  for select using (is_couple_member(couple_id) or inviter_id = auth.uid());

create policy "couple_invites_insert" on public.couple_invites
  for insert with check (inviter_id = auth.uid());

create policy "couple_invites_update" on public.couple_invites
  for update using (true); -- needed for accepting invite (accepter isn't a member yet)

-- goals: full access if in the couple
create policy "goals_couple" on public.goals
  for all using (is_couple_member(couple_id));

-- completions: full access if goal belongs to your couple
create policy "completions_couple" on public.completions
  for all using (
    exists (
      select 1 from public.goals g
      where g.id = completions.goal_id
        and is_couple_member(g.couple_id)
    )
  );

-- completion_media: full access if completion belongs to your couple
create policy "completion_media_couple" on public.completion_media
  for all using (
    exists (
      select 1
      from public.completions c
      join public.goals g on g.id = c.goal_id
      where c.id = completion_media.completion_id
        and is_couple_member(g.couple_id)
    )
  );
