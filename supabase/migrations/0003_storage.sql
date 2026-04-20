-- Storage bucket for check-in photos/videos
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Allow couple members to upload to their couple's folder
create policy "media_upload" on storage.objects
  for insert with check (
    bucket_id = 'media'
    and auth.uid() is not null
  );

-- Anyone can read media (bucket is public)
create policy "media_read" on storage.objects
  for select using (bucket_id = 'media');

-- Only uploader can delete
create policy "media_delete" on storage.objects
  for delete using (
    bucket_id = 'media'
    and owner = auth.uid()
  );
