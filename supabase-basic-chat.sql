-- YumeChat MVP basic chat schema
-- Supabase PostgreSQL
-- Tables: public.users, public.characters, public.messages
-- Auth source: auth.users

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Users profile table
-- Supabase Auth stores credentials in auth.users.
-- This table stores app-level user profile data.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Characters table
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subtitle text,
  description text,
  avatar_url text,
  banner_url text,
  tags text[] not null default '{}',
  greeting_message text,
  personality text,
  scenario text,
  system_prompt text not null,
  distilled_profile text,
  affection integer not null default 0 check (affection >= 0 and affection <= 100),
  mood text not null default 'calm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists users_email_idx
  on public.users(email);

create index if not exists characters_user_id_idx
  on public.characters(user_id);

create index if not exists characters_updated_at_idx
  on public.characters(updated_at desc);

create index if not exists messages_user_id_idx
  on public.messages(user_id);

create index if not exists messages_character_created_idx
  on public.messages(character_id, created_at);

create index if not exists messages_user_character_created_idx
  on public.messages(user_id, character_id, created_at);

-- updated_at triggers
drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_characters_updated_at on public.characters;
create trigger set_characters_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

-- Automatically create public.users row when a Supabase Auth user signs up.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.characters enable row level security;
alter table public.messages enable row level security;

-- RLS: users
drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
on public.users for select
using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users for update
using (id = auth.uid())
with check (id = auth.uid());

-- RLS: characters
drop policy if exists "Users can read own characters" on public.characters;
create policy "Users can read own characters"
on public.characters for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own characters" on public.characters;
create policy "Users can insert own characters"
on public.characters for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own characters" on public.characters;
create policy "Users can update own characters"
on public.characters for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own characters" on public.characters;
create policy "Users can delete own characters"
on public.characters for delete
using (user_id = auth.uid());

-- RLS: messages
drop policy if exists "Users can read own messages" on public.messages;
create policy "Users can read own messages"
on public.messages for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own messages" on public.messages;
create policy "Users can insert own messages"
on public.messages for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.characters
    where characters.id = messages.character_id
      and characters.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own messages" on public.messages;
create policy "Users can delete own messages"
on public.messages for delete
using (user_id = auth.uid());
