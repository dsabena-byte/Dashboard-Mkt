# DV360 Video Sync — automatización del reporte de visibilidad de video

Automatiza el embudo de visibilidad de video de **DV360** (Display & Video 360)
hacia Supabase, para el panel **"Visibilidad real de video · DV360"** del dash de
Performance (tab Por Medio).

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
        │  - agrega por (mes, fuente): YouTube/TrueView vs Programmatic Video
        │  - delete-por-mes + insert (idempotente) a Supabase
        │  - manda a papelera los emails procesados (no acumula)
        ▼
  Supabase principal · tabla dv360_video_metrics
        ▼
  Dashboard /performance → Por Medio → "Visibilidad real de video · DV360"
```

- **Por qué email y no Drive**: DV360 no entrega directo a Drive (solo email o
  Cloud Storage). Email → Apps Script (GmailApp) es una hop menos.
- **Por qué Apps Script y no la Bid Manager API**: evita service account / OAuth
  refresh tokens. Reusa las credenciales `PLANNING_SUPABASE_*` ya configuradas.

## Estado al 2026-06-16 (handoff)

| Paso | Estado |
|------|--------|
| Tabla `dv360_video_metrics` (migración 0056) | ✅ creada en Supabase |
| Seed manual (Mar 18 – Jun 15, instant report) | ✅ cargado y validado |
| Panel "Visibilidad real de video · DV360" | ✅ en main (PR #236) |
| Reporte DV360 "DV360 Video Drean" programado (Daily, CSV, **Attachment**, email a dsabena@gmail.com) | ⏳ configurado por el usuario — confirmar Save |
| Filtro Gmail "Asunto contiene DV360 Video Drean" → etiqueta `dv360` | ⏳ pendiente |
| Función `syncDv360` pegada en Apps Script | ⏳ **PENDIENTE (terminar al volver)** |
| Trigger diario para `syncDv360` | ⏳ pendiente |
| Test manual (Log = HTTP 201) cuando llegue el 1er email | ⏳ pendiente |

## Pasos para terminar (cuando vuelva el usuario)

1. Confirmar que el **Schedule** de DV360 quedó guardado: Daily · Format CSV ·
   Delivery ON · **Attachment** · Email a dsabena@gmail.com.
2. Crear el **filtro de Gmail**: barra de búsqueda → controles → Asunto contiene
   `DV360 Video Drean` → Crear filtro → ✅ Aplicar etiqueta `dv360`
   (opcional: ✅ Saltar Recibidos).
3. **Pegar `syncDv360`** (código abajo) en el editor de Apps Script del proyecto
   "Sync Drive Tablero CB".
4. Cuando llegue el **primer email** (etiqueta `dv360`), correr `syncDv360` a mano
   una vez → revisar Log: debe decir `HTTP 201`.
5. Agregar **trigger diario**: ⏰ Triggers → Add → Time-driven → Day timer → `syncDv360`.

## Lógica de clasificación de fuente (igual que el seed validado)

- Line Item contiene `youtube` / `trueview` / `true view` → **YouTube/TrueView**
- Creative Type = `Video` o Line Item contiene `video` / `open exchange` → **Programmatic Video**
- resto → **Display** (se ignora en el panel, no es video)

YouTube/TrueView aparece con Creative `Unknown` / Creative Type `Standard` — es
normal (DV360 no expone el creative de YouTube), por eso se clasifica por Line Item.

## Código final — `syncDv360` (pegar en Apps Script)

```javascript
/** Sincroniza el reporte de video de DV360 (CSV por email) a Supabase. Idempotente. */
function syncDv360() {
  var props = PropertiesService.getScriptProperties();
  var URL = props.getProperty('PLANNING_SUPABASE_URL');
  var KEY = props.getProperty('PLANNING_SUPABASE_SECRET_KEY');
  if (!URL || !KEY) { Logger.log('Faltan properties Supabase'); return; }

  // 1) CSV adjunto más reciente del email de DV360 (recuerda threads para limpiar)
  var csv = null, when = 0;
  var threads = GmailApp.search('label:dv360 has:attachment newer_than:7d', 0, 10);
  threads.forEach(function(t){
    t.getMessages().forEach(function(m){
      m.getAttachments().forEach(function(a){
        if (a.getName().toLowerCase().indexOf('.csv') >= 0 && m.getDate().getTime() > when){
          csv = a.getDataAsString(); when = m.getDate().getTime();
        }
      });
    });
  });
  if (!csv) { Logger.log('No se encontró CSV de DV360'); return; }

  // 2) Parsear y agregar por (mes, fuente)
  var g = Utilities.parseCsv(csv), h = g[0];
  function ix(n){ return h.indexOf(n); }
  var iCT=ix('Creative Type'), iLI=ix('Line Item'), iD=ix('Date'), iImp=ix('Impressions'),
      iRev=ix('Revenue (USD)'), iSt=ix('Starts (Video)'), iSk=ix('Skips (Video)'),
      iQ1=ix('First-Quartile Views (Video)'), iM=ix('Midpoint Views (Video)'),
      iQ3=ix('Third-Quartile Views (Video)'), iC=ix('Complete Views (Video)');
  if (iD<0||iImp<0||iSt<0){ Logger.log('Header inesperado'); return; }
  function num(x){ var n=parseFloat(String(x).replace('%','').replace(/,/g,'').trim()); return isNaN(n)?0:n; }
  function fuente(row){
    var li=String(row[iLI]||'').toLowerCase();
    if (li.indexOf('youtube')>=0||li.indexOf('trueview')>=0||li.indexOf('true view')>=0) return 'YouTube/TrueView';
    if (String(row[iCT])==='Video'||li.indexOf('video')>=0||li.indexOf('open exchange')>=0) return 'Programmatic Video';
    return 'Display';
  }
  var skip=['Report Time','Date Range','Group By','MRC','Filter by','Reporting numbers'];
  var agg={}, meses={};
  for (var r=1;r<g.length;r++){
    var row=g[r]; if(!row||!row[0]||row.length<6) continue;
    var c0=String(row[0]); if(skip.some(function(s){return c0.indexOf(s)===0;})) continue;
    var p=String(row[iD]||'').split('/'); if(p.length<2) continue;
    var mes=p[0]+'-'+p[1]+'-01', fu=fuente(row), k=mes+'|'+fu;
    var a=agg[k]||(agg[k]={mes:mes,fuente:fu,impresiones:0,starts:0,q25:0,q50:0,q75:0,q100:0,skips:0,revenue_usd:0});
    a.impresiones+=num(row[iImp]); a.starts+=num(row[iSt]); a.skips+=num(row[iSk]);
    a.q25+=num(row[iQ1]); a.q50+=num(row[iM]); a.q75+=num(row[iQ3]); a.q100+=num(row[iC]);
    a.revenue_usd+=num(row[iRev]); meses[mes]=true;
  }
  var recs=Object.keys(agg).map(function(k){
    var a=agg[k]; a.source='dv360_scheduled';
    ['impresiones','starts','skips','q25','q50','q75','q100'].forEach(function(f){ a[f]=Math.round(a[f]); });
    a.revenue_usd=Math.round(a.revenue_usd*10000)/10000; return a;
  });
  if (recs.length===0){ Logger.log('Sin filas'); return; }

  // 3) Borrar-por-mes + reinsertar (reemplaza seed manual y corridas previas)
  var base=URL.replace(/\/$/,'')+'/rest/v1/dv360_video_metrics';
  var KEYH={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
  var inList='("'+Object.keys(meses).join('","')+'")';
  UrlFetchApp.fetch(base+'?mes=in.'+encodeURIComponent(inList), {method:'delete',headers:KEYH,muteHttpExceptions:true});
  var resp=UrlFetchApp.fetch(base, {method:'post',
    headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
    payload:JSON.stringify(recs), muteHttpExceptions:true});
  var ok = resp.getResponseCode() >= 200 && resp.getResponseCode() < 300;
  Logger.log('DV360 sync: '+recs.length+' filas, meses '+Object.keys(meses).join(',')+' → HTTP '+resp.getResponseCode());
  // Limpieza: si cargó OK, manda a papelera los emails procesados (evita acumular)
  if (ok) { threads.forEach(function(t){ t.moveToTrash(); }); }
}
```

## Troubleshooting

- **"No se encontró CSV de DV360"** → el email no llegó aún, o el filtro no aplicó
  la etiqueta `dv360`, o el adjunto no es `.csv` (revisá que el Schedule esté en
  Format CSV + Attachment).
- **"Header inesperado"** → el CSV cambió de columnas. Verificá que el reporte
  tenga las columnas: Date, Creative Type, Line Item, Impressions, Revenue (USD),
  Starts/First-Quartile/Midpoint/Third-Quartile/Complete Views (Video).
- **HTTP 401/403** → properties `PLANNING_SUPABASE_URL` / `PLANNING_SUPABASE_SECRET_KEY`
  mal seteadas.
- **HTTP 409** → no debería pasar (se borra por mes antes de insertar). Si pasa,
  revisá que el `delete` por `mes=in.(...)` haya corrido.

## Referencias

- Tabla: `supabase/migrations/0056_dv360_video_metrics.sql`
- Seed inicial: `supabase/seed/dv360_video_metrics.sql`
- Query/agregación: `apps/web/src/lib/dv360-queries.ts`
- Panel: `apps/web/src/components/pauta/performance-client.tsx` ("Visibilidad real de video · DV360")
- Partner DV360: Mabe Argentina (7996192225)
