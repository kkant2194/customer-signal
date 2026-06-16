create extension if not exists vector;

alter table public.feedback_items
  add column if not exists embedding vector(1536);

create index if not exists feedback_items_embedding_hnsw_idx
  on public.feedback_items
  using hnsw (embedding vector_cosine_ops);

create index if not exists feedback_items_user_workspace_embedding_idx
  on public.feedback_items(user_id, workspace_id)
  where embedding is not null;

create or replace function public.match_feedback_items(
  query_embedding vector(1536),
  match_workspace_id uuid,
  match_count integer default 20,
  match_threshold double precision default 0.15
)
returns table (
  id uuid,
  source text,
  customer text,
  title text,
  excerpt text,
  sentiment text,
  theme text,
  rating integer,
  plan text,
  similarity double precision
)
language sql
stable
security invoker
as $$
  select
    feedback_items.id,
    feedback_items.source,
    feedback_items.customer,
    feedback_items.title,
    feedback_items.excerpt,
    feedback_items.sentiment,
    feedback_items.theme,
    feedback_items.rating,
    feedback_items.plan,
    1 - (feedback_items.embedding <=> query_embedding) as similarity
  from public.feedback_items
  where feedback_items.user_id = auth.uid()
    and feedback_items.workspace_id = match_workspace_id
    and feedback_items.embedding is not null
    and 1 - (feedback_items.embedding <=> query_embedding) >= match_threshold
  order by feedback_items.embedding <=> query_embedding
  limit least(match_count, 20);
$$;
