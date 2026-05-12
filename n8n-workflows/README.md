# N8N workflows

Carpeta para exports JSON de workflows de N8N. Vacía en fase 1, se llena en fase 2.

## Convención

- Un archivo por workflow: `<dominio>-<accion>.json`
  - `gads-ingest-daily.json`
  - `meta-ingest-daily.json`
  - `ga4-ingest-daily.json`
  - `sheets-planning-sync.json`
  - `sheets-social-sync.json`
  - `apify-competitors-weekly.json`
  - `alerts-eval-hourly.json`

## Cómo exportar desde N8N

1. Abrir el workflow en N8N.
2. Menú `⋮` → **Download**.
3. Guardar el JSON acá con el nombre que corresponde.
4. Commit.

## Cómo importar a otra instancia de N8N

1. En N8N: **Workflows → Import from File**.
2. Seleccionar el JSON.
3. Reconfigurar credenciales (las credenciales NO se exportan por seguridad).

## Credenciales

Las credenciales (API keys, OAuth tokens) **nunca** van al repo. Se configuran
una vez en N8N por instancia. El JSON exportado solo guarda el nombre de la
credencial, no el valor.

## Variables de entorno (N8N)

| Variable                       | Uso                                |
|--------------------------------|------------------------------------|
| `SUPABASE_URL`                 | URL del proyecto                   |
| `SUPABASE_SERVICE_ROLE_KEY`    | Para UPSERTs server-side           |
| `GOOGLE_ADS_DEVELOPER_TOKEN`   | Google Ads API                     |
| `META_ACCESS_TOKEN`            | Meta Marketing API                 |
| `GA4_PROPERTY_ID`              | GA4 Reporting API                  |
| `APIFY_API_TOKEN`              | Apify (fase 3)                     |
