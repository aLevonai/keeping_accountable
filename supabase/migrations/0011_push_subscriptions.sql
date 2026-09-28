-- One row per device, so notifications reach every phone/laptop a person has
-- installed the app on (users.push_token held a single device and was
-- overwritten by the latest one to subscribe).
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  endpoint     text not null unique,
  subscription jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Carry over existing single-device tokens (skipping any malformed ones).
do $$
declare
  r record;
  sub jsonb;
begin
  for r in select id, push_token from public.users where push_token is not null loop
    begin
      sub := r.push_token::jsonb;
      if sub ? 'endpoint' then
        insert into public.push_subscriptions (user_id, endpoint, subscription)
        values (r.id, sub->>'endpoint', sub)
        on conflict (endpoint) do nothing;
      end if;
    exception when others then
      null;
    end;
  end loop;
end $$;
