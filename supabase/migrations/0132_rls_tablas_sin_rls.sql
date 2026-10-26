-- 0132 · Cerrar la ESCRITURA anónima (auditoría 26-oct-2026).
-- Estas 23 tablas no tenían RLS: con la clave pública del sitio se podían
-- insertar, modificar y borrar filas (metas, Mapa, facturación, mirrors de CB…).
-- Se activa RLS con una única policy de LECTURA para anon/authenticated:
--   * las lecturas quedan exactamente como hoy (se cierran en la etapa siguiente);
--   * nadie sin service_role puede escribir (todos los escritores del código
--     usan la service key, que no pasa por RLS).
-- Idempotente.
do $$
declare t text;
begin
  foreach t in array array[
    'cb_semanal_mirror','cb_tienda_cliente_mirror','facturacion_mensual','floor_share_mirror',
    'fs_precomputed','fx_rates','kpi_meta_config','kpi_meta_valores','mapa_estrategico',
    'meta_fb_monthly_reach','search_region','search_volume','seo_domain_overview',
    'seo_index_history','seo_keyword_gap','seo_llmo','seo_rankings','trade_monthly',
    'trends_interest','ugc_comments','ugc_piece_analysis','web_daily_by_category',
    'web_monthly_by_category'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists lectura_dashboard on public.%I', t);
    execute format('create policy lectura_dashboard on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
