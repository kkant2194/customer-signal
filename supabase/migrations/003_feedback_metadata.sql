alter table public.feedback_items
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists feedback_items_metadata_gin_idx
  on public.feedback_items
  using gin (metadata);
