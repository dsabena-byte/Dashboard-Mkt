# Setup de Supabase paso a paso

Si nunca usaste Supabase, seguí esta guía. Toma ~10 minutos.

## 1. Crear cuenta y proyecto

1. Ir a [supabase.com](https://supabase.com) y registrate (puede ser con GitHub).
2. Click en **New project**.
3. Datos del proyecto:
   - **Name**: `dashboard-mkt` (o el que prefieras)
   - **Database password**: generá una fuerte y **guardala en 1Password / gestor**
     (la vas a necesitar si querés conectarte a la DB con un cliente SQL).
   - **Region**: la más cercana (ej: `South America (São Paulo)`).
   - **Plan**: Free (alcanza para arrancar).
4. Esperá 1-2 minutos a que se aprovisione.

## 2. Aplicar las migraciones

1. En el panel de Supabase, ir a **SQL Editor** (ícono `</>` en el sidebar).
2. Click en **New query**.
3. Abrir el archivo local `supabase/migrations/0001_initial_schema.sql`, copiar
   todo el contenido y pegarlo en el editor.
4. Click en **Run** (o Ctrl/Cmd + Enter).
5. Debería decir "Success. No rows returned".
6. Repetir con `supabase/migrations/0002_views.sql`.

## 3. (Opcional) Cargar data de prueba

Para ver el dashboard con datos de mentira mientras integrás las fuentes reales:

1. **SQL Editor → New query**.
2. Pegar el contenido de `supabase/seed/seed.sql`.
3. Run.

## 4. Verificar

En **Table Editor** (sidebar) deberías ver las tablas:

- `planning`, `ads_performance`, `web_traffic`, `competitor_web`,
  `social_metrics`, `social_competitor`, `alerts_config`, `alerts_log`

Y en **Database → Views**:

- `vw_funnel_diario`, `vw_cumplimiento_planning`

## 5. Copiar las API keys

1. **Settings → API** (ícono engranaje).
2. Copiá:
   - **Project URL** → va en `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → va en `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secreto, solo server)
3. Pegarlas en `apps/web/.env.local` (creado desde `.env.example`).

## 6. (Opcional) Row Level Security

Por defecto Supabase deja RLS desactivado en tablas nuevas, lo que significa
que cualquiera con la anon key puede leer todo. Esto está OK mientras el
dashboard sea uso interno y el repo sea privado.

Cuando agreguemos auth (fase 2) habilitamos RLS con policies por usuario.

## 7. (Opcional) Conectar Supabase CLI local

Si querés trabajar con migraciones desde la CLI en vez de copiar/pegar SQL:

```bash
npm i -g supabase
supabase login                            # te abre browser para auth
supabase link --project-ref <PROJECT_REF> # el ref está en la URL del proyecto
supabase db push                          # aplica migraciones de /supabase/migrations
pnpm db:types                             # regenera tipos TS desde la DB
```

## Troubleshooting

- **"relation X already exists"** al correr 0001: ya la corriste antes. Borrá
  el proyecto (Settings → General → Delete project) y empezá de cero, o aplicá
  solo las diferencias.
- **El frontend tira "Faltan NEXT_PUBLIC_SUPABASE_URL"**: no creaste
  `apps/web/.env.local` o no reiniciaste el dev server (`pnpm dev`).
- **Las vistas devuelven 0 filas**: corré también el seed (`seed.sql`).
