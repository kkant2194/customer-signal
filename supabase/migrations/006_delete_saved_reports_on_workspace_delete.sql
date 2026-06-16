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
