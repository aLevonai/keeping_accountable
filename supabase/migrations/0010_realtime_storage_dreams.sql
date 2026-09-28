-- 1. Realtime. The app subscribes to changes on these tables, but none of them
--    were in the supabase_realtime publication, so no events were ever
--    delivered: partner check-ins, joins and dream updates only appeared after
--    a reload. Idempotent — skips tables that are already published.
do $$
declare
  t text;
begin
  foreach t in array array['goals', 'completions', 'completion_media', 'dreams', 'couple_members', 'users'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 2. Storage cleanup. Deleting was uploader-only, so removing a goal or a
--    partner's check-in left their photos in the bucket forever. Any member of
--    the couple that owns the folder may now delete (mirrors media_read).
drop policy if exists "media_delete" on storage.objects;
create policy "media_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and public.is_couple_member(((storage.foldername(name))[2])::uuid)
  );

-- 3. Dream achievements become journal entries: an optional photo + note,
--    and who marked it achieved.
alter table public.dreams
  add column if not exists achieved_note text,
  add column if not exists achieved_photo_path text,
  add column if not exists achieved_photo_width integer,
  add column if not exists achieved_photo_height integer,
  add column if not exists achieved_by uuid references public.users(id) on delete set null;
