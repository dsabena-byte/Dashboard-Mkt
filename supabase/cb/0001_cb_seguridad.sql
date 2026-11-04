-- Proyecto CB (dashboard-cb-fs, fsvdcpqzchrezkxflyfi) — NO es el principal: correr en el SQL Editor de ESE proyecto.
-- Cierra las alertas del security advisor (4-nov-2026): RLS apagado en 7 tablas, 3 vistas SECURITY DEFINER,
-- set_updated_at con search_path mutable, y lectura anónima (anon/authenticated tenían SELECT en todo public).
-- Quién lee/escribe este proyecto: el tablero (getCbSupabase, service role) y el Apps Script (SUPABASE_SECRET_KEY = service
-- role). Los dos saltean RLS → sin políticas no cambia nada para ellos. Idempotente.

alter table public.contactos             enable row level security;
alter table public.cuadro_basico_semanal enable row level security;
alter table public.floor_share           enable row level security;
alter table public.reporte_existencia    enable row level security;
alter table public.cb_homologos          enable row level security;
alter table public.cb_cadena_alias       enable row level security;
alter table public.sync_status           enable row level security;

alter view public.vw_cb_suggestions        set (security_invoker = true);
alter view public.vw_cb_suggestions_detail set (security_invoker = true);
alter view public.vw_cb_baseline_medidas   set (security_invoker = true);

revoke all on all tables in schema public from anon, authenticated;
-- Que las tablas/vistas nuevas tampoco nazcan con permisos para anon/authenticated.
alter default privileges in schema public revoke all on tables from anon, authenticated;

alter function public.set_updated_at() set search_path = public;
