create table public.dreams (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  owner_id     uuid references public.users(id) on delete set null,
  title        text not null,
  note         text,
  emoji        text not null default '✨',
  achieved_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.dreams enable row level security;

create policy "dreams_couple" on public.dreams
  for all using (is_couple_member(couple_id));
