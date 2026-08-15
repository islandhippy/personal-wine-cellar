-- Private label-photo storage for the sole cellar owner.
-- Objects use the path: <user-id>/<wine-id>/<front-or-back>-<uuid>.<extension>

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'wine-labels',
  'wine-labels',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy wine_labels_select_own
on storage.objects for select
to authenticated
using (
  bucket_id = 'wine-labels'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy wine_labels_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'wine-labels'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy wine_labels_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'wine-labels'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'wine-labels'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy wine_labels_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'wine-labels'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
