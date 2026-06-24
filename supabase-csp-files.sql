-- YumeChat CSP file upload support
-- Run this in Supabase SQL Editor after supabase-basic-chat.sql.
-- Adds file URL columns and a public Storage bucket for character assets.

alter table public.characters
add column if not exists csp_skill_file_url text,
add column if not exists manifest_file_url text,
add column if not exists distillation_file_url text;

insert into storage.buckets (id, name, public)
values ('character-assets', 'character-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Users can upload own character assets" on storage.objects;
create policy "Users can upload own character assets"
on storage.objects for insert
with check (
  bucket_id = 'character-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can read own character assets" on storage.objects;
create policy "Users can read own character assets"
on storage.objects for select
using (
  bucket_id = 'character-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);
