do $$
declare
  item record;
begin
  for item in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', item.tablename);
    execute format(
      'revoke all on table public.%I from anon, authenticated',
      item.tablename
    );
  end loop;
end $$;

do $$
declare
  item record;
begin
  for item in
    select table_name
    from information_schema.views
    where table_schema = 'public'
  loop
    execute format(
      'revoke all on table public.%I from anon, authenticated',
      item.table_name
    );
  end loop;
end $$;

-- SECURITY DEFINER functions are private by default. The admin RPCs below are
-- explicitly granted back to service_role only.
do $$
declare
  item record;
begin
  for item in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      item.signature
    );
  end loop;
end $$;

revoke all
on function public.list_managed_users(text, uuid, uuid, integer, integer)
from public, anon, authenticated;
grant execute
on function public.list_managed_users(text, uuid, uuid, integer, integer)
to service_role;

revoke all
on function public.list_activity_logs(text, text, uuid, boolean, date, integer, integer)
from public, anon, authenticated;
grant execute
on function public.list_activity_logs(text, text, uuid, boolean, date, integer, integer)
to service_role;

revoke all
on function public.activity_log_filter_options()
from public, anon, authenticated;
grant execute
on function public.activity_log_filter_options()
to service_role;

revoke all
on function public.list_integrations(text, text, uuid, integer, integer)
from public, anon, authenticated;
grant execute
on function public.list_integrations(text, text, uuid, integer, integer)
to service_role;

revoke all
on function public.integration_summary()
from public, anon, authenticated;
grant execute
on function public.integration_summary()
to service_role;
