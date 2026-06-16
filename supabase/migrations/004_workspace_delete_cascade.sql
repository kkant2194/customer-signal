do $$
declare
  constraint_name text;
begin
  select tc.constraint_name
    into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'saved_reports'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'workspace_id'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.saved_reports drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.saved_reports
  add constraint saved_reports_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspaces(id)
  on delete cascade;

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
create trigger delete_workspace_usage_events
before delete on public.workspaces
for each row execute function public.delete_workspace_usage_events();

drop policy if exists "usage_events_delete_own" on public.usage_events;
create policy "usage_events_delete_own" on public.usage_events
  for delete using (user_id = auth.uid());
