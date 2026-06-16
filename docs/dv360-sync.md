# DV360 Sync — automatización de la pauta general de DV360

Automatiza la pauta de **DV360** (Display & Video 360) hacia Supabase, por
**mes y canal** (YouTube, Programmatic, Marketplace, Demand Gen): impresiones,
clicks, costo (USD) y embudo de video (cuartiles). Alimenta el dash de
Performance (tab Por Medio): tabla **"DV360 por canal"** + **"Visibilidad real
de video · DV360"**.

> **Google Search NO está en DV360** (vive en Google Ads). El reporte trae 0
> filas de Search. Si se quiere, va por una sync separada de Google Ads.

## Arquitectura (la más directa, sin API keys ni service accounts)

```
  DV360 (reporte programado "DV360 Video Drean")
        │  entrega CSV por email (Attachment) — diario
        ▼
  Gmail (filtro → etiqueta 'dv360')
        │
        ▼
  Apps Script syncDv360()  (corre con la cuenta Google del dueño)
        │  - lee el CSV adjunto más reciente (GmailApp)
        │  - agrega por (mes, canal)
        │  - delete-por-mes + insert (idempotente) a Supabase
        │  - manda a papelera los emails procesados (no acumula)
        ▼
  Supabase principal · tabla dv360_performance
        ▼
  Dashboard /performance → Por Medio
```

- **Por qué email y no Drive**: DV360 no entrega directo a Drive (solo email o
  Cloud Storage). Email → Apps Script (GmailApp) es una hop menos.
- **Por qué Apps Script y no Bid Manager API**: evita service account / OAuth.
  Reusa las properties `PLANNING_SUPABASE_*` ya configuradas.

## Reporte de DV360 — columnas necesarias

Dimensiones: `Date`, `Creative Type`, `Insertion Order`, `Line Item`, `Creative`.
Métricas: `Impressions`, `Clicks`, `Revenue (USD)`, `Starts (Video)`,
`Skips (Video)`, `First-Quartile / Midpoint / Third-Quartile / Complete Views (Video)`.

## Clasificación de canal (por Line Item)

| Line Item contiene            | canal          |
|-------------------------------|----------------|
| `youtube` / `trueview` / `bumper` | **YouTube**     |
| `demand gen` / `demandgen`    | **Demand Gen**  |
| `marketplace`                 | **Marketplace** |
| `search`                      | **Search** (no debería aparecer) |
| resto                         | **Programmatic**|

YouTube aparece con Creative `Unknown` / Creative Type `Standard` — es normal
(DV360 no expone el creative de YouTube), por eso se clasifica por Line Item.

## Estado al 2026-06-16 (handoff)

| Paso | Estado |
|------|--------|
| Tabla `dv360_performance` (migración 0057, reemplaza `dv360_video_metrics`) | ⏳ correr migración + seed en Supabase |
| Seed con el reporte (Mar 18 – Jun 15, con Clicks) | ⏳ `supabase/seed/dv360_performance.sql` |
| Panel "DV360 por canal" + "Visibilidad real de video · DV360" | ✅ en main |
| Reporte DV360 programado (Daily, CSV, Attachment, email) + métrica Clicks | ✅ configurado |
| Filtro Gmail → etiqueta `dv360` | ⏳ pendiente |
| Función `syncDv360` en Apps Script (versión nueva, tabla `dv360_performance`) | ⏳ **REEMPLAZAR la vieja** |
| Trigger diario para `syncDv360` | ⏳ pendiente |

## Pasos para terminar

1. Correr en Supabase (proyecto principal) la **migración 0057** y el **seed**
   `dv360_performance.sql`.
2. Crear el **filtro de Gmail**: Asunto contiene `DV360 Video Drean` → etiqueta `dv360`.
3. **Reemplazar** la función `syncDv360` del Apps Script por la versión de abajo
   (escribe a `dv360_performance`, con Clicks y canal).
4. Cuando llegue el primer email, correr `syncDv360` a mano → Log `HTTP 201`.
5. Trigger diario: ⏰ Triggers → Add → Day timer → `syncDv360`.

## Código final — `syncDv360` (pegar/reemplazar en Apps Script)

```javascript
/** Sincroniza la pauta de DV360 (CSV por email) a Supabase. Idempotente. */
function syncDv360() {
  var props = PropertiesService.getScriptProperties();
  var URL = props.getProperty('PLANNING_SUPABASE_URL');
  var KEY = props.getProperty('PLANNING_SUPABASE_SECRET_KEY');
  if (!URL || !KEY) { Logger.log('Faltan properties Supabase'); return; }

  // 1) CSV adjunto más reciente del email de DV360
  var csv = null, when = 0;
  var threads = GmailApp.search('label:dv360 has:attachment newer_than:7d', 0, 10);
  threads.forEach(function(t){ t.getMessages().forEach(function(m){ m.getAttachments().forEach(function(a){
    if (a.getName().toLowerCase().indexOf('.csv') >= 0 && m.getDate().getTime() > when){ csv=a.getDataAsString(); when=m.getDate().getTime(); }
  }); }); });
  if (!csv) { Logger.log('No se encontró CSV de DV360'); return; }

  // 2) Parsear y agregar por (mes, canal)
  var g = Utilities.parseCsv(csv), h = g[0];
  function ix(n){ return h.indexOf(n); }
  var iLI=ix('Line Item'), iD=ix('Date'), iImp=ix('Impressions'), iClk=ix('Clicks'), iRev=ix('Revenue (USD)'),
      iSt=ix('Starts (Video)'), iSk=ix('Skips (Video)'),
      iQ1=ix('First-Quartile Views (Video)'), iM=ix('Midpoint Views (Video)'),
      iQ3=ix('Third-Quartile Views (Video)'), iC=ix('Complete Views (Video)');
  if (iD<0||iImp<0||iRev<0){ Logger.log('Header inesperado'); return; }
  function num(x){ var n=parseFloat(String(x).replace('%','').replace(/,/g,'').trim()); return isNaN(n)?0:n; }
  function canal(name){
    var l=String(name||'').toLowerCase();
    if (l.indexOf('youtube')>=0||l.indexOf('trueview')>=0||l.indexOf('bumper')>=0) return 'YouTube';
    if (l.indexOf('demand gen')>=0||l.indexOf('demandgen')>=0) return 'Demand Gen';
    if (l.indexOf('marketplace')>=0) return 'Marketplace';
    if (l.indexOf('search')>=0) return 'Search';
    return 'Programmatic';
  }
  var skip=['Report Time','Date Range','Group By','MRC','Filter by','Reporting numbers'];
  var agg={}, meses={};
  for (var r=1;r<g.length;r++){
    var row=g[r]; if(!row||!row[0]||row.length<6) continue;
    var c0=String(row[0]); if(skip.some(function(s){return c0.indexOf(s)===0;})) continue;
    var p=String(row[iD]||'').split('/'); if(p.length<2) continue;
    var mes=p[0]+'-'+p[1]+'-01', cn=canal(row[iLI]), k=mes+'|'+cn;
    var a=agg[k]||(agg[k]={mes:mes,canal:cn,impresiones:0,clicks:0,starts:0,q25:0,q50:0,q75:0,q100:0,skips:0,revenue_usd:0});
    a.impresiones+=num(row[iImp]); a.clicks+=(iClk>=0?num(row[iClk]):0); a.revenue_usd+=num(row[iRev]);
    a.starts+=num(row[iSt]); a.skips+=num(row[iSk]);
    a.q25+=num(row[iQ1]); a.q50+=num(row[iM]); a.q75+=num(row[iQ3]); a.q100+=num(row[iC]);
    meses[mes]=true;
  }
  var recs=Object.keys(agg).map(function(k){
    var a=agg[k]; a.source='dv360_scheduled';
    ['impresiones','clicks','starts','skips','q25','q50','q75','q100'].forEach(function(f){ a[f]=Math.round(a[f]); });
    a.revenue_usd=Math.round(a.revenue_usd*10000)/10000; return a;
  });
  if (recs.length===0){ Logger.log('Sin filas'); return; }

  // 3) Borrar-por-mes + reinsertar (reemplaza seed manual y corridas previas)
  var base=URL.replace(/\/$/,'')+'/rest/v1/dv360_performance';
  var KEYH={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
  var inList='("'+Object.keys(meses).join('","')+'")';
  UrlFetchApp.fetch(base+'?mes=in.'+encodeURIComponent(inList), {method:'delete',headers:KEYH,muteHttpExceptions:true});
  var resp=UrlFetchApp.fetch(base, {method:'post',
    headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
    payload:JSON.stringify(recs), muteHttpExceptions:true});
  var ok = resp.getResponseCode() >= 200 && resp.getResponseCode() < 300;
  Logger.log('DV360 sync: '+recs.length+' filas, meses '+Object.keys(meses).join(',')+' → HTTP '+resp.getResponseCode());
  if (ok) { threads.forEach(function(t){ t.moveToTrash(); }); }
}
```

## Troubleshooting

- **"No se encontró CSV de DV360"** → el email no llegó aún, o el filtro no aplicó
  la etiqueta `dv360`, o el adjunto no es `.csv`.
- **"Header inesperado"** → faltan columnas en el reporte (ver lista arriba).
- **HTTP 401/403** → properties `PLANNING_SUPABASE_*` mal seteadas.
- **HTTP 404** → falta correr la migración 0057 (tabla `dv360_performance`).

## Referencias

- Migración: `supabase/migrations/0057_dv360_performance.sql`
- Seed inicial: `supabase/seed/dv360_performance.sql`
- Query/agregación: `apps/web/src/lib/dv360-queries.ts`
- Panel: `apps/web/src/components/pauta/performance-client.tsx`
- Partner DV360: Mabe Argentina (7996192225)
