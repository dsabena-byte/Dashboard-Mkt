# DV360 Sync — pauta general de DV360 (piezas + reach)

Automatiza la pauta de **DV360** hacia Supabase con **2 reportes**:
1. **"DV360 Video Drean"** (por Creative) → `dv360_creatives` (piezas, KPIs, video).
2. **"DV360 Reach Drean"** (por Month × Line Item) → `dv360_reach` (alcance único + frecuencia).

El resumen por canal y el embudo de video se **derivan en código** de `dv360_creatives`.
Alimenta el dash de Performance (tab Por Medio): tabla por canal (con reach),
piezas pautadas y embudo de video.

> **Por qué 2 reportes**: DV360 **no da reach por pieza** (las métricas de Unique
> Reach se deshabilitan con la dimensión Creative). El reach sólo existe a nivel
> Line Item. Por eso un reporte para piezas (Creative) y otro para reach (Month ×
> Line Item).
>
> **Google Search NO está en DV360** (vive en Google Ads) → no se incluye.

## Arquitectura

```
  DV360 ─ reporte "DV360 Video Drean" (Creative)  ─┐
       └ reporte "DV360 Reach Drean"  (Month×LI)  ─┤  CSV por email (Attachment), diario
                                                    ▼
                                       Gmail (filtro → etiqueta 'dv360')
                                                    ▼
                       Apps Script: syncDv360() + syncDv360Reach()
                          - leen el CSV adjunto más reciente de cada reporte
                          - agregan y hacen delete-por-mes + insert (idempotente)
                                                    ▼
                       Supabase principal: dv360_creatives + dv360_reach
                                                    ▼
                       Dashboard /performance → Por Medio
```

Reusa las properties `PLANNING_SUPABASE_*`. Sin API keys ni service accounts.

## Reportes de DV360 — configuración

**Reporte 1 "DV360 Video Drean" (piezas):**
- Dimensiones: `Date`, `Creative`, `Creative Type`, `Insertion Order`, `Line Item`.
- Métricas: `Impressions`, `Clicks`, `Revenue (USD)`, `Starts (Video)`,
  `Skips (Video)`, `First-Quartile / Midpoint / Third-Quartile / Complete Views (Video)`.

**Reporte 2 "DV360 Reach Drean" (reach):**
- Dimensiones: `Month`, `Insertion Order`, `Line Item` (⚠️ **sin Creative**, si no
  el reach se deshabilita). **Usar `Month`, no `Date`** (si no, el reach es diario
  y no se puede sumar entre días).
- Métricas: `Impressions`, `Revenue (USD)`, `Unique Reach: Impression Reach`,
  `Unique Reach: Average Impression Frequency`.

Ambos: programados **Daily**, Format **CSV**, Delivery **Attachment**, email a
dsabena@gmail.com. Filtro Gmail (asunto contiene "DV360") → etiqueta `dv360`.

## Clasificación de canal (por Line Item, en ambos scripts)

| Line Item contiene            | canal          |
|-------------------------------|----------------|
| `youtube` / `trueview` / `bumper` | **YouTube**     |
| `demand gen` / `demandgen`    | **Demand Gen**  |
| `marketplace`                 | **Marketplace** |
| `search`                      | **Search** (no aparece) |
| resto                         | **Programmatic**|

## Estado al 2026-06-16 (handoff)

| Paso | Estado |
|------|--------|
| Migración 0058 (`dv360_creatives` + `dv360_reach`, reemplaza `dv360_performance`) | ⏳ correr en Supabase |
| Seeds `dv360_creatives.sql` + `dv360_reach.sql` | ⏳ correr en Supabase |
| Panels (canal+reach, piezas, embudo) | ✅ en main |
| Reporte 1 programado + filtro Gmail | ✅ |
| Reporte 2 (reach) programado | ⏳ guardar como "DV360 Reach Drean" + Schedule |
| `syncDv360` + `syncDv360Reach` en Apps Script | ⏳ **pegar/reemplazar** |
| Triggers diarios | ⏳ pendiente |

## Código — pegar/reemplazar en Apps Script

### syncDv360 (piezas → dv360_creatives)

```javascript
/** Sincroniza piezas de DV360 (reporte por Creative) a dv360_creatives. Idempotente. */
function syncDv360() {
  var p = PropertiesService.getScriptProperties();
  var URL = p.getProperty('PLANNING_SUPABASE_URL'), KEY = p.getProperty('PLANNING_SUPABASE_SECRET_KEY');
  if (!URL || !KEY) { Logger.log('Faltan properties Supabase'); return; }
  var got = dv360FindCsv_('DV360 Video Drean');   // {csv, threads}
  if (!got.csv) { Logger.log('No se encontró CSV de piezas'); return; }
  var g = Utilities.parseCsv(got.csv), h = g[0];
  function ix(n){ return h.indexOf(n); }
  var iCr=ix('Creative'), iLI=ix('Line Item'), iD=ix('Date'), iImp=ix('Impressions'), iClk=ix('Clicks'),
      iRev=ix('Revenue (USD)'), iSt=ix('Starts (Video)'), iSk=ix('Skips (Video)'),
      iQ1=ix('First-Quartile Views (Video)'), iM=ix('Midpoint Views (Video)'),
      iQ3=ix('Third-Quartile Views (Video)'), iC=ix('Complete Views (Video)');
  if (iD<0||iImp<0||iCr<0){ Logger.log('Header inesperado (piezas)'); return; }
  var agg={}, meses={};
  for (var r=1;r<g.length;r++){
    var row=g[r]; if(!dv360DataRow_(row)) continue;
    var pr=String(row[iD]||'').split('/'); if(pr.length<2) continue;
    var mes=pr[0]+'-'+pr[1]+'-01', cn=dv360Canal_(row[iLI]), name=String(row[iCr]||''), k=mes+'|'+cn+'|'+name;
    var a=agg[k]||(agg[k]={mes:mes,canal:cn,creative:name,impresiones:0,clicks:0,starts:0,q25:0,q50:0,q75:0,q100:0,skips:0,revenue_usd:0});
    a.impresiones+=dv360Num_(row[iImp]); a.clicks+=dv360Num_(row[iClk]); a.revenue_usd+=dv360Num_(row[iRev]);
    a.starts+=dv360Num_(row[iSt]); a.skips+=dv360Num_(row[iSk]);
    a.q25+=dv360Num_(row[iQ1]); a.q50+=dv360Num_(row[iM]); a.q75+=dv360Num_(row[iQ3]); a.q100+=dv360Num_(row[iC]);
    meses[mes]=true;
  }
  var recs=Object.keys(agg).map(function(k){
    var a=agg[k]; a.source='dv360_scheduled';
    ['impresiones','clicks','starts','skips','q25','q50','q75','q100'].forEach(function(f){a[f]=Math.round(a[f]);});
    a.revenue_usd=Math.round(a.revenue_usd*10000)/10000; return a;
  });
  dv360Upsert_('dv360_creatives', recs, meses, got.threads);
}
```

### syncDv360Reach (reach → dv360_reach)

```javascript
/** Sincroniza reach de DV360 (reporte por Month×LineItem) a dv360_reach. Idempotente. */
function syncDv360Reach() {
  var p = PropertiesService.getScriptProperties();
  var URL = p.getProperty('PLANNING_SUPABASE_URL'), KEY = p.getProperty('PLANNING_SUPABASE_SECRET_KEY');
  if (!URL || !KEY) { Logger.log('Faltan properties Supabase'); return; }
  var got = dv360FindCsv_('DV360 Reach Drean');
  if (!got.csv) { Logger.log('No se encontró CSV de reach'); return; }
  var g = Utilities.parseCsv(got.csv), h = g[0];
  function ix(n){ return h.indexOf(n); }
  var iMo=ix('Month'), iLI=ix('Line Item'), iImp=ix('Impressions'), iRev=ix('Revenue (USD)'),
      iR=ix('Unique Reach: Impression Reach'), iF=ix('Unique Reach: Average Impression Frequency');
  if (iMo<0||iLI<0||iR<0){ Logger.log('Header inesperado (reach)'); return; }
  var agg={}, meses={};
  for (var r=1;r<g.length;r++){
    var row=g[r]; if(!dv360DataRow_(row)) continue;
    var mes=String(row[iMo]||'').replace('/','-')+'-01';   // 2026/04 -> 2026-04-01
    if (mes.length<7) continue;
    var li=String(row[iLI]||''), cn=dv360Canal_(li), k=mes+'|'+li;
    var a=agg[k]||(agg[k]={mes:mes,canal:cn,line_item:li,impresiones:0,revenue_usd:0,reach:0,frequency:0});
    a.impresiones+=dv360Num_(row[iImp]); a.revenue_usd+=dv360Num_(row[iRev]);
    a.reach+=dv360Num_(row[iR]); a.frequency=dv360Num_(row[iF]);
    meses[mes]=true;
  }
  var recs=Object.keys(agg).map(function(k){
    var a=agg[k]; a.source='dv360_scheduled';
    a.impresiones=Math.round(a.impresiones); a.reach=Math.round(a.reach);
    a.revenue_usd=Math.round(a.revenue_usd*10000)/10000; a.frequency=Math.round(a.frequency*10000)/10000; return a;
  });
  dv360Upsert_('dv360_reach', recs, meses, got.threads);
}
```

### Helpers compartidos

```javascript
function dv360Num_(x){ var n=parseFloat(String(x).replace('%','').replace(/,/g,'').trim()); return isNaN(n)?0:n; }
function dv360Canal_(name){
  var l=String(name||'').toLowerCase();
  if (l.indexOf('youtube')>=0||l.indexOf('trueview')>=0||l.indexOf('bumper')>=0) return 'YouTube';
  if (l.indexOf('demand gen')>=0||l.indexOf('demandgen')>=0) return 'Demand Gen';
  if (l.indexOf('marketplace')>=0) return 'Marketplace';
  if (l.indexOf('search')>=0) return 'Search';
  return 'Programmatic';
}
function dv360DataRow_(row){
  if(!row||!row[0]||row.length<5) return false;
  var c0=String(row[0]);
  var skip=['Report Time','Date Range','Group By','MRC','Filter by','Reporting numbers','This report','A dash'];
  for (var i=0;i<skip.length;i++) if(c0.indexOf(skip[i])===0) return false;
  return true;
}
function dv360FindCsv_(subject){
  var csv=null, when=0, threads=GmailApp.search('label:dv360 subject:"'+subject+'" has:attachment newer_than:7d', 0, 10);
  threads.forEach(function(t){ t.getMessages().forEach(function(m){ m.getAttachments().forEach(function(a){
    if (a.getName().toLowerCase().indexOf('.csv')>=0 && m.getDate().getTime()>when){ csv=a.getDataAsString(); when=m.getDate().getTime(); }
  }); }); });
  return { csv: csv, threads: threads };
}
function dv360Upsert_(table, recs, meses, threads){
  if (!recs.length){ Logger.log(table+': sin filas'); return; }
  var p=PropertiesService.getScriptProperties();
  var URL=p.getProperty('PLANNING_SUPABASE_URL'), KEY=p.getProperty('PLANNING_SUPABASE_SECRET_KEY');
  var base=URL.replace(/\/$/,'')+'/rest/v1/'+table;
  var H={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
  var inList='("'+Object.keys(meses).join('","')+'")';
  UrlFetchApp.fetch(base+'?mes=in.'+encodeURIComponent(inList), {method:'delete',headers:H,muteHttpExceptions:true});
  var resp=UrlFetchApp.fetch(base, {method:'post',
    headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
    payload:JSON.stringify(recs), muteHttpExceptions:true});
  var ok=resp.getResponseCode()>=200&&resp.getResponseCode()<300;
  Logger.log(table+': '+recs.length+' filas → HTTP '+resp.getResponseCode());
  if (ok && threads) threads.forEach(function(t){ t.moveToTrash(); });
}
```

## Pasos para terminar

1. Correr en Supabase: **migración 0058** + seeds `dv360_creatives.sql` y `dv360_reach.sql`.
2. **Reporte 2** en DV360: guardar como "DV360 Reach Drean" + Schedule (Daily/CSV/Attachment/email).
3. Pegar en Apps Script: `syncDv360`, `syncDv360Reach` y los 4 helpers `dv360*_`.
4. Correr ambas a mano una vez (Log `HTTP 201`/`204`).
5. Triggers diarios para `syncDv360` y `syncDv360Reach`.

## Troubleshooting

- **HTTP 404** → falta correr la migración 0058.
- **"No se encontró CSV"** → el email no llegó / filtro no aplicó la etiqueta / el subject no matchea (`subject:"DV360 Video Drean"` / `"DV360 Reach Drean"`).
- **Header inesperado** → faltan columnas (ver config de cada reporte).
- Reach con **"-"** en filas chicas → DV360 no pudo calcular (poco volumen/cookies). Se computa como 0.

## Referencias

- Migración: `supabase/migrations/0058_dv360_creatives_reach.sql`
- Seeds: `supabase/seed/dv360_creatives.sql`, `supabase/seed/dv360_reach.sql`
- Lógica: `apps/web/src/lib/dv360-data.ts`, `apps/web/src/lib/dv360-queries.ts`
- Panel: `apps/web/src/components/pauta/performance-client.tsx`
- Partner DV360: Mabe Argentina (7996192225)
