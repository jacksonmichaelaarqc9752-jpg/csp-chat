-- YumeChat advanced features schema
-- Run this after supabase-basic-chat.sql.
-- Adds:
-- 1. Long-term memory with pgvector
-- 2. Image message support and Supabase Storage bucket
-- 3. Persistent mood and affection state

create extension if not exists vector;

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

create index if not exists character_memories_user_character_idx
  on public.character_memories(user_id, character_id);

create index if not exists character_memories_embedding_idx
  on public.character_memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists relationship_states_user_character_idx
  on public.relationship_states(user_id, character_id);

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

alter table public.character_memories enable row level security;
alter table public.relationship_states enable row level security;

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
