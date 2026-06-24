-- YumeChat MVP schema for Supabase SQL Editor
-- Tables: public.users, public.characters, public.messages,
-- public.character_memories, public.relationship_states
-- Auth source: auth.users

create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.messages
add column if not exists image_url text;

create table if not exists public.character_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  content text not null,
  memory_type text not null default 'user_fact',
  importance integer not null default 1 check (importance >= 1 and importance <= 5),
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.relationship_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  mood text not null default 'neutral',
  affection integer not null default 0 check (affection >= 0 and affection <= 100),
  state_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, character_id)
);

create index if not exists characters_user_id_idx on public.characters(user_id);
create index if not exists characters_updated_at_idx on public.characters(updated_at desc);
create index if not exists messages_user_character_created_idx
  on public.messages(user_id, character_id, created_at);
create index if not exists character_memories_user_character_idx
  on public.character_memories(user_id, character_id);
create index if not exists character_memories_embedding_idx
  on public.character_memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
create index if not exists relationship_states_user_character_idx
  on public.relationship_states(user_id, character_id);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_characters_updated_at on public.characters;
create trigger set_characters_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

drop trigger if exists set_character_memories_updated_at on public.character_memories;
create trigger set_character_memories_updated_at
before update on public.character_memories
for each row execute function public.set_updated_at();

drop trigger if exists set_relationship_states_updated_at on public.relationship_states;
create trigger set_relationship_states_updated_at
before update on public.relationship_states
for each row execute function public.set_updated_at();

create or replace function public.match_character_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_character_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  memory_type text,
  importance integer,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    character_memories.id,
    character_memories.content,
    character_memories.memory_type,
    character_memories.importance,
    character_memories.metadata,
    1 - (character_memories.embedding <=> query_embedding) as similarity
  from public.character_memories
  where character_memories.user_id = match_user_id
    and character_memories.character_id = match_character_id
    and character_memories.embedding is not null
  order by character_memories.embedding <=> query_embedding
  limit match_count;
$$;

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

alter table public.users enable row level security;
alter table public.characters enable row level security;
alter table public.messages enable row level security;
alter table public.character_memories enable row level security;
alter table public.relationship_states enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
on public.users for select
using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users for update
using (id = auth.uid())
with check (id = auth.uid());

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

drop policy if exists "Users can read own memories" on public.character_memories;
create policy "Users can read own memories"
on public.character_memories for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own memories" on public.character_memories;
create policy "Users can insert own memories"
on public.character_memories for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.characters
    where characters.id = character_memories.character_id
      and characters.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own memories" on public.character_memories;
create policy "Users can update own memories"
on public.character_memories for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own memories" on public.character_memories;
create policy "Users can delete own memories"
on public.character_memories for delete
using (user_id = auth.uid());

drop policy if exists "Users can read own relationship states" on public.relationship_states;
create policy "Users can read own relationship states"
on public.relationship_states for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own relationship states" on public.relationship_states;
create policy "Users can insert own relationship states"
on public.relationship_states for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.characters
    where characters.id = relationship_states.character_id
      and characters.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own relationship states" on public.relationship_states;
create policy "Users can update own relationship states"
on public.relationship_states for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Users can upload own chat images" on storage.objects;
create policy "Users can upload own chat images"
on storage.objects for insert
with check (
  bucket_id = 'chat-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can read own chat images" on storage.objects;
create policy "Users can read own chat images"
on storage.objects for select
using (
  bucket_id = 'chat-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
