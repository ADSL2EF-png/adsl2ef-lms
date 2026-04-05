insert into storage.buckets (id, name, public)
values ('adsl2ef-files', 'adsl2ef-files', true)
on conflict (id) do nothing;

create policy "service role storage access"
on storage.objects
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "authenticated users upload files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'adsl2ef-files');

create policy "authenticated users read files"
on storage.objects
for select
to authenticated
using (bucket_id = 'adsl2ef-files');
