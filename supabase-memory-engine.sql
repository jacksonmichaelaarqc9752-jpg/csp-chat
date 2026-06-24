-- YumeChat Memory Engine
-- Run this in Supabase SQL Editor.
-- Requires Supabase Postgres with pgvector.

create extension if not exists vector;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  source_message_id uuid references public.messages(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists memories_user_character_idx
  on public.memories(user_id, character_id, created_at desc);

create index if not exists memories_source_message_idx
  on public.memories(source_message_id);

create index if not exists memories_embedding_idx
  on public.memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_character_id uuid,
  match_count int default 3
)
returns table (
  id uuid,
  content text,
  source_message_id uuid,
  created_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    memories.id,
    memories.content,
    memories.source_message_id,
    memories.created_at,
    1 - (memories.embedding <=> query_embedding) as similarity
  from public.memories
  where memories.user_id = match_user_id
    and memories.character_id = match_character_id
    and memories.embedding is not null
  order by memories.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.memories enable row level security;

drop policy if exists "Users can read own memories" on public.memories;
create policy "Users can read own memories"
on public.memories for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own memories" on public.memories;
create policy "Users can insert own memories"
on public.memories for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.characters
    where characters.id = memories.character_id
      and characters.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own memories" on public.memories;
create policy "Users can delete own memories"
on public.memories for delete
using (user_id = auth.uid());
