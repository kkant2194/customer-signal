delete from public.feedback_items
where not exists (
  select 1
  from public.workspaces
  where workspaces.id = feedback_items.workspace_id
);

delete from public.saved_reports
where workspace_id is not null
  and not exists (
    select 1
    from public.workspaces
    where workspaces.id = saved_reports.workspace_id
  );

delete from public.usage_events
where metadata ? 'workspace_id'
  and not exists (
    select 1
    from public.workspaces
    where workspaces.id::text = usage_events.metadata ->> 'workspace_id'
  );

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
    and tc.table_name = 'feedback_items'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'workspace_id'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.feedback_items drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.feedback_items
  add constraint feedback_items_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspaces(id)
  on delete cascade;
