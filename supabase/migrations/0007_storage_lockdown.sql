-- Lock down the media bucket: photos are private couple content.
-- Reads now require a short-lived signed URL (createSignedUrl) instead of a
-- public URL, and both read + upload are authorized per-object by couple
-- membership. Object paths are `completions/<coupleId>/<userId>/<completionId>/...`
-- so the couple id is the 2nd path segment.

update storage.buckets set public = false where id = 'media';

-- Couple-scoped read (replaces the world-readable media_read policy).
drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'media'
    and public.is_couple_member(((storage.foldername(name))[2])::uuid)
  );

-- Uploads must target the caller's own couple folder (was: any authed user
-- could write into any couple's folder).
drop policy if exists "media_upload" on storage.objects;
create policy "media_upload" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and public.is_couple_member(((storage.foldername(name))[2])::uuid)
  );

-- Hardening: pin search_path and use a cached auth.uid() so the helper used by
-- every policy can't be hijacked via search_path and isn't re-evaluated per row.
create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members
    where couple_id = p_couple_id
      and user_id   = (select auth.uid())
  );
$$;
