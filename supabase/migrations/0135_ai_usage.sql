-- 0135 · Cuota diaria PERSISTIDA de IA paga (OpenAI / fal) por usuario y función (auditoría D-10, 26-oct-2026).
-- La lee/escribe SOLO el server con la service key (lib/ai-quota.ts). Idempotente.
-- Sin esta migración la app sigue andando con el freno en memoria (fail-safe en el código).
create table if not exists public.ai_usage (
  dia date not null,
  email text not null,
  feature text not null,
  n int not null default 0,
  primary key (dia, email, feature)
);
alter table public.ai_usage enable row level security; -- sin policies: nadie con sesión la ve
revoke all on public.ai_usage from public, anon, authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;

-- Suma 1 al contador de HOY (hora Argentina) y devuelve false si ya llegó al tope. Atómico: el
-- upsert solo actualiza si n < p_limit, así dos pedidos simultáneos no pasan el tope.
create or replace function public.ai_usage_take(p_email text, p_feature text, p_limit int)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_n int;
begin
  if p_limit is null or p_limit < 1 then
    return false;
  end if;
  insert into public.ai_usage as u (dia, email, feature, n)
  values ((now() at time zone 'America/Argentina/Buenos_Aires')::date, lower(p_email), p_feature, 1)
  on conflict (dia, email, feature) do update set n = u.n + 1 where u.n < p_limit
  returning u.n into v_n;
  return v_n is not null;
end;
$$;
revoke all on function public.ai_usage_take(text, text, int) from public, anon, authenticated;
grant execute on function public.ai_usage_take(text, text, int) to service_role;
