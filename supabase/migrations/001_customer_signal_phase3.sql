create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  owner text not null,
  product text not null default 'Product area',
  active_members integer not null default 1,
  health text not null default 'Active' check (health in ('Active', 'Reviewing', 'Paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,
  customer text not null default 'Unknown customer',
  title text not null,
  excerpt text not null,
  sentiment text not null default 'neutral' check (sentiment in ('positive', 'neutral', 'negative')),
  theme text not null default 'Uncategorized feedback',
  status text not null default 'new' check (status in ('new', 'triaged', 'planned', 'closed')),
  revenue text not null default '$0',
  rating integer not null default 3 check (rating between 1 and 5),
  plan text not null default 'Business' check (plan in ('Free', 'Pro', 'Business', 'Enterprise')),
  feedback_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  type text not null default 'AI analysis',
  status text not null default 'Ready' check (status in ('Ready', 'Draft', 'Scheduled')),
  owner text not null default 'Product team',
  question text,
  answer text,
  evidence_count integer,
  themes jsonb,
  quotes jsonb,
  actions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sample_datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sample_feedback_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sample_dataset_id uuid not null references public.sample_datasets(id) on delete cascade,
  source text not null,
  customer text not null,
  title text not null,
  excerpt text not null,
  sentiment text not null default 'neutral' check (sentiment in ('positive', 'neutral', 'negative')),
  theme text not null default 'Uncategorized feedback',
  rating integer not null default 3 check (rating between 1 and 5),
  plan text not null default 'Business' check (plan in ('Free', 'Pro', 'Business', 'Enterprise')),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_user_id_idx on public.workspaces(user_id);
create index if not exists feedback_items_user_id_idx on public.feedback_items(user_id);
create index if not exists feedback_items_workspace_id_idx on public.feedback_items(workspace_id);
create index if not exists saved_reports_user_id_idx on public.saved_reports(user_id);
create index if not exists sample_datasets_user_id_idx on public.sample_datasets(user_id);
create index if not exists sample_feedback_items_user_id_idx on public.sample_feedback_items(user_id);
create index if not exists usage_events_user_id_idx on public.usage_events(user_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.feedback_items enable row level security;
alter table public.saved_reports enable row level security;
alter table public.sample_datasets enable row level security;
alter table public.sample_feedback_items enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "workspaces_select_own" on public.workspaces;
drop policy if exists "workspaces_insert_own" on public.workspaces;
drop policy if exists "workspaces_update_own" on public.workspaces;
drop policy if exists "workspaces_delete_own" on public.workspaces;

create policy "workspaces_select_own" on public.workspaces for select using (user_id = auth.uid());
create policy "workspaces_insert_own" on public.workspaces for insert with check (user_id = auth.uid());
create policy "workspaces_update_own" on public.workspaces for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workspaces_delete_own" on public.workspaces for delete using (user_id = auth.uid());

drop policy if exists "feedback_items_select_own" on public.feedback_items;
drop policy if exists "feedback_items_insert_own" on public.feedback_items;
drop policy if exists "feedback_items_update_own" on public.feedback_items;
drop policy if exists "feedback_items_delete_own" on public.feedback_items;

create policy "feedback_items_select_own" on public.feedback_items for select using (user_id = auth.uid());
create policy "feedback_items_insert_own" on public.feedback_items for insert with check (user_id = auth.uid());
create policy "feedback_items_update_own" on public.feedback_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "feedback_items_delete_own" on public.feedback_items for delete using (user_id = auth.uid());

drop policy if exists "saved_reports_select_own" on public.saved_reports;
drop policy if exists "saved_reports_insert_own" on public.saved_reports;
drop policy if exists "saved_reports_update_own" on public.saved_reports;
drop policy if exists "saved_reports_delete_own" on public.saved_reports;

create policy "saved_reports_select_own" on public.saved_reports for select using (user_id = auth.uid());
create policy "saved_reports_insert_own" on public.saved_reports for insert with check (user_id = auth.uid());
create policy "saved_reports_update_own" on public.saved_reports for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_reports_delete_own" on public.saved_reports for delete using (user_id = auth.uid());

drop policy if exists "sample_datasets_select_own" on public.sample_datasets;
drop policy if exists "sample_datasets_insert_own" on public.sample_datasets;
drop policy if exists "sample_datasets_update_own" on public.sample_datasets;
drop policy if exists "sample_datasets_delete_own" on public.sample_datasets;

create policy "sample_datasets_select_own" on public.sample_datasets for select using (user_id = auth.uid());
create policy "sample_datasets_insert_own" on public.sample_datasets for insert with check (user_id = auth.uid());
create policy "sample_datasets_update_own" on public.sample_datasets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sample_datasets_delete_own" on public.sample_datasets for delete using (user_id = auth.uid());

drop policy if exists "sample_feedback_items_select_own" on public.sample_feedback_items;
drop policy if exists "sample_feedback_items_insert_own" on public.sample_feedback_items;
drop policy if exists "sample_feedback_items_update_own" on public.sample_feedback_items;
drop policy if exists "sample_feedback_items_delete_own" on public.sample_feedback_items;

create policy "sample_feedback_items_select_own" on public.sample_feedback_items for select using (user_id = auth.uid());
create policy "sample_feedback_items_insert_own" on public.sample_feedback_items for insert with check (user_id = auth.uid());
create policy "sample_feedback_items_update_own" on public.sample_feedback_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sample_feedback_items_delete_own" on public.sample_feedback_items for delete using (user_id = auth.uid());

drop policy if exists "usage_events_select_own" on public.usage_events;
drop policy if exists "usage_events_insert_own" on public.usage_events;
drop policy if exists "usage_events_delete_own" on public.usage_events;

create policy "usage_events_select_own" on public.usage_events for select using (user_id = auth.uid());
create policy "usage_events_insert_own" on public.usage_events for insert with check (user_id = auth.uid());
create policy "usage_events_delete_own" on public.usage_events for delete using (user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
drop trigger if exists set_workspaces_updated_at on public.workspaces;
drop trigger if exists set_feedback_items_updated_at on public.feedback_items;
drop trigger if exists set_saved_reports_updated_at on public.saved_reports;
drop trigger if exists set_sample_datasets_updated_at on public.sample_datasets;

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger set_feedback_items_updated_at before update on public.feedback_items for each row execute function public.set_updated_at();
create trigger set_saved_reports_updated_at before update on public.saved_reports for each row execute function public.set_updated_at();
create trigger set_sample_datasets_updated_at before update on public.sample_datasets for each row execute function public.set_updated_at();

create or replace function public.delete_workspace_usage_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.usage_events
  where user_id = old.user_id
    and metadata ->> 'workspace_id' = old.id::text;

  return old;
end;
$$;

drop trigger if exists delete_workspace_usage_events on public.workspaces;
create trigger delete_workspace_usage_events before delete on public.workspaces for each row execute function public.delete_workspace_usage_events();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
