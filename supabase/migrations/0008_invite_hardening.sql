-- Harden the pairing flow.
-- 1. A couple may have at most 2 members — enforced in the DB, not just the UI.
-- 2. The invite UPDATE policy was `using (true)` (anyone could mutate any
--    invite). Restrict it to accepting an unaccepted, unexpired invite.
--
-- Note: real 7-day expiry and wider/crypto-random codes are set on the client
-- (utils/invite.ts + onboard/profile). The `couple_invites_active_lookup`
-- policy (live) is intentionally kept — the joining user must read the invite
-- by code before they are a member.

-- Cap couple size at 2.
create or replace function public.enforce_couple_size()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'A couple can have at most 2 members';
  end if;
  return new;
end;
$$;

drop trigger if exists couple_members_max_two on public.couple_members;
create trigger couple_members_max_two
  before insert on public.couple_members
  for each row execute function public.enforce_couple_size();

-- This is a trigger-only function; it should never be callable as an RPC.
revoke execute on function public.enforce_couple_size() from public, anon, authenticated;

-- Tighten invite updates. Was `using (true)` — anyone could mutate any invite,
-- including already-accepted ones. Now an authenticated user may update a row
-- only if it's a still-pending invite (the join/accept path, where the accepter
-- isn't a member yet) OR they belong to that couple (the inviter regenerating /
-- expiring their own codes). WITH CHECK stays permissive: the meaningful guard
-- is *which* rows you may touch, not what you set — and a strict post-state
-- check would race the parallel couple_members insert during accept.
drop policy if exists "couple_invites_update" on public.couple_invites;
create policy "couple_invites_update" on public.couple_invites
  for update
  to authenticated
  using (
    (accepted_at is null and expires_at > now())
    or public.is_couple_member(couple_id)
  )
  -- The accepter sets accepted_at (passes the first branch without needing
  -- membership, which avoids racing the parallel couple_members insert); the
  -- inviter managing their own codes passes via membership.
  with check (
    accepted_at is not null
    or public.is_couple_member(couple_id)
  );
