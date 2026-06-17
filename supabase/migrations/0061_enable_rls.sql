-- =============================================================================
-- 0061_enable_rls: cierra la exposición pública de Supabase (warning
-- rls_disabled_in_public). El dashboard lee con la ANON key, así que habilitamos
-- RLS en todas las tablas del schema public y dejamos SOLO LECTURA para anon y
-- authenticated. Las escrituras (crons, Apps Script) usan la service_role key,
-- que SALTEA RLS → siguen funcionando. Resultado: nadie de afuera puede
-- insertar/actualizar/borrar vía la API pública.
-- Aplicar en el SQL Editor del proyecto principal.
-- =============================================================================

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security;', t.tablename);
    execute format('drop policy if exists rls_anon_read on public.%I;', t.tablename);
    execute format('create policy rls_anon_read on public.%I for select to anon using (true);', t.tablename);
    execute format('drop policy if exists rls_auth_read on public.%I;', t.tablename);
    execute format('create policy rls_auth_read on public.%I for select to authenticated using (true);', t.tablename);
  end loop;
end $$;
