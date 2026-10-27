// DV360 sync por API: paridad con el Apps Script (syncDv360 / syncDv360Reach) + ventana de meses + guarda anti-parcial.
// Datos SINTÉTICOS (no reales). cd apps/web && npx tsx scripts/dv360-report.test.ts
import { aggCreatives, aggReach, decidirMes, parseCsv, planMeses, totalesPorMes } from "../src/lib/dv360-report";

let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.error(`✗ ${m}`); } };

// ── Apps Script COPIADO tal cual de docs/dv360-sync.md (solo cambia: recibe la grilla y devuelve recs) ──
/* eslint-disable */
function dv360Num_(x: any){ var n=parseFloat(String(x).replace('%','').replace(/,/g,'').trim()); return isNaN(n)?0:n; }
function dv360EstadoRank_(s: any){ s=String(s||'').toLowerCase(); if (s.indexOf('active')>=0) return 3; if (s.indexOf('paused')>=0) return 2; if (s.indexOf('archiv')>=0) return 1; return 0; }
function dv360Canal_(name: any){ var l=String(name||'').toLowerCase();
  if (l.indexOf('youtube')>=0||l.indexOf('trueview')>=0||l.indexOf('bumper')>=0) return 'YouTube';
  if (l.indexOf('demand gen')>=0||l.indexOf('demandgen')>=0) return 'Demand Gen';
  if (l.indexOf('marketplace')>=0) return 'Marketplace';
  if (l.indexOf('search')>=0) return 'Search';
  return 'Programmatic'; }
function dv360Categoria_(name: any){ var l=String(name||'').toLowerCase();
  if (l.indexOf('lavado')>=0) return 'Lavado';
  if (l.indexOf('refriger')>=0||l.indexOf('heladera')>=0) return 'Refrigeración';
  if (l.indexOf('coccion')>=0||l.indexOf('cocción')>=0||l.indexOf('cocina')>=0) return 'Cocción';
  if (l.indexOf('promoc')>=0||l.indexOf('drean week')>=0) return 'Promoción';
  if (l.indexOf('brand')>=0) return 'Brand';
  return 'General'; }
function dv360Rol_(name: any){ var l=String(name||'').toLowerCase();
  if (l.indexOf('cpv')>=0||l.indexOf('trueview')>=0||l.indexOf('demand gen')>=0||l.indexOf('demandgen')>=0) return 'Consideración';
  return 'Awareness'; }
function dv360DataRow_(row: any){ if(!row||!row[0]||row.length<5) return false; var c0=String(row[0]);
  var skip=['Report Time','Date Range','Group By','MRC','Filter by','Reporting numbers','This report','A dash'];
  for (var i=0;i<skip.length;i++) if(c0.indexOf(skip[i])===0) return false; return true; }
function appsScriptCreatives(g: string[][]){
  var h = g[0]!; function ix(n: string){ return h.indexOf(n); }
  var iCr=ix('Creative'), iLI=ix('Line Item'), iD=ix('Date'), iImp=ix('Impressions'), iClk=ix('Clicks'),
      iRev=ix('Revenue (USD)'), iSt=ix('Starts (Video)'), iSk=ix('Skips (Video)'),
      iQ1=ix('First-Quartile Views (Video)'), iM=ix('Midpoint Views (Video)'),
      iQ3=ix('Third-Quartile Views (Video)'), iC=ix('Complete Views (Video)');
  var iEst=ix('Line Item Status'); if (iEst<0) iEst=ix('Status');
  var agg: any={}, meses: any={};
  for (var r=1;r<g.length;r++){
    var row: any=g[r]; if(!dv360DataRow_(row)) continue;
    var pr=String(row[iD]||'').split('/'); if(pr.length<2) continue;
    var li=String(row[iLI]||''), mes=pr[0]+'-'+pr[1]+'-01', cn=dv360Canal_(li),
        cat=dv360Categoria_(li), rl=dv360Rol_(li), name=String(row[iCr]||''), k=mes+'|'+cn+'|'+cat+'|'+rl+'|'+name;
    var a=agg[k]||(agg[k]={mes:mes,canal:cn,categoria:cat,rol:rl,creative:name,impresiones:0,clicks:0,starts:0,q25:0,q50:0,q75:0,q100:0,skips:0,revenue_usd:0,line_item_status:null,_stRank:-1});
    a.impresiones+=dv360Num_(row[iImp]); a.clicks+=dv360Num_(row[iClk]); a.revenue_usd+=dv360Num_(row[iRev]);
    a.starts+=dv360Num_(row[iSt]); a.skips+=dv360Num_(row[iSk]);
    a.q25+=dv360Num_(row[iQ1]); a.q50+=dv360Num_(row[iM]); a.q75+=dv360Num_(row[iQ3]); a.q100+=dv360Num_(row[iC]);
    if (iEst>=0){ var st=String(row[iEst]||'').trim(), rk=dv360EstadoRank_(st); if (rk>a._stRank){ a._stRank=rk; a.line_item_status=st||a.line_item_status; } }
    meses[mes]=true;
  }
  return Object.keys(agg).map(function(k){
    var a=agg[k]; a.source='dv360_scheduled'; delete a._stRank;
    ['impresiones','clicks','starts','skips','q25','q50','q75','q100'].forEach(function(f){a[f]=Math.round(a[f]);});
    a.revenue_usd=Math.round(a.revenue_usd*10000)/10000; return a;
  });
}
function appsScriptReach(g: string[][]){
  var h = g[0]!; function ix(n: string){ return h.indexOf(n); }
  var iMo=ix('Month'), iLI=ix('Line Item'), iImp=ix('Impressions'), iRev=ix('Revenue (USD)'),
      iR=ix('Unique Reach: Impression Reach'), iF=ix('Unique Reach: Average Impression Frequency');
  var agg: any={};
  for (var r=1;r<g.length;r++){
    var row: any=g[r]; if(!dv360DataRow_(row)) continue;
    var mes=String(row[iMo]||'').replace('/','-')+'-01'; if (mes.length<7) continue;
    var li=String(row[iLI]||''), cn=dv360Canal_(li), k=mes+'|'+li;
    var a=agg[k]||(agg[k]={mes:mes,canal:cn,line_item:li,impresiones:0,revenue_usd:0,reach:0,frequency:0});
    a.impresiones+=dv360Num_(row[iImp]); a.revenue_usd+=dv360Num_(row[iRev]);
    a.reach+=dv360Num_(row[iR]); a.frequency=dv360Num_(row[iF]);
  }
  return Object.keys(agg).map(function(k){
    var a=agg[k]; a.source='dv360_scheduled';
    a.impresiones=Math.round(a.impresiones); a.reach=Math.round(a.reach);
    a.revenue_usd=Math.round(a.revenue_usd*10000)/10000; a.frequency=Math.round(a.frequency*10000)/10000; return a;
  });
}
/* eslint-enable */

// ── CSV sintético con la forma del reporte de DV360 (columna extra Line Item ID, comillas, pie de reporte) ──
const H = 'Date,Creative,Line Item ID,Line Item,Line Item Status,Impressions,Clicks,Revenue (USD),Starts (Video),Skips (Video),First-Quartile Views (Video),Midpoint Views (Video),Third-Quartile Views (Video),Complete Views (Video)';
const crCsv = [
  H,
  '2026/09/01,Unknown,111,Mabe_Drean_Lavado_Youtube_Trueview,Active,"1,000",10,12.34567,900,100,800,700,600,500',
  '2026/09/02,Unknown,111,Mabe_Drean_Lavado_Youtube_Trueview,Paused,2000,20,1.11111,1800,200,1600,1400,1200,1000',
  '2026/09/02,Unknown,112,Mabe_Drean_Lavado_Youtube_Trueview,Archived,5,0,0.00004,0,0,0,0,0,0',
  '2026/09/03,"Imagen_Refrigeración_Heladera, SbS (300X600) - Banner",221,Drean_Programmatic_CPM_Heladera Duplicado,Paused,3000,3,4.5,0,0,0,0,0,0',
  '2026/10/04,Banner Cocina 320x50,331,Drean Marketplace Cocción,Active,10,1,0.5,0,0,0,0,0,0',
  '2026/10/04,Promo,441,Drean Week Promoción Demand Gen CPV,,10,1,0.5,0,0,0,0,0,0',
  '2026/10/05,Brand video,551,Drean Brand Bumper,ENTITY_STATUS_ACTIVE,7.6,0.4,0.33333,1,0,0,0,0,0',
  ',,,,,9999,9,9,9,9,9,9,9,9', // fila de totales (sin primera columna)
  'Report Time:,2026/10/26 10:00 GMT-03:00,,,',
  'Date Range:,2026/09/01 to 2026/10/25,,,',
  'Filter by Partner ID:,7996192225,,,',
].join("\r\n") + "\r\n";

const g = parseCsv(crCsv);
ok(g[4]![1] === "Imagen_Refrigeración_Heladera, SbS (300X600) - Banner" && g[1]![5] === "1,000", "parseCsv: comillas con coma y miles");
const nuestro = aggCreatives(crCsv, "dv360_scheduled");
const script = appsScriptCreatives(g);
const ord = (x: any[]) => [...x].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
ok(JSON.stringify(ord(nuestro.rows)) === JSON.stringify(ord(script)), `creatives = Apps Script\n${JSON.stringify(ord(nuestro.rows))}\n${JSON.stringify(ord(script))}`);
const yt = nuestro.rows.find((r) => r.canal === "YouTube")!;
ok(yt && yt.impresiones === 3005 && yt.line_item_status === "Active" && yt.rol === "Consideración" && yt.categoria === "Lavado" && yt.revenue_usd === 13.4568, "YouTube: suma, estado más activo, rol, categoría, 4 decimales");
ok(nuestro.rows.length === 5 && nuestro.meses.sort().join() === "2026-09-01,2026-10-01", "5 claves, 2 meses; totales y pie descartados");

const reCsv = [
  "Month,Line Item ID,Line Item,Impressions,Revenue (USD),Unique Reach: Impression Reach,Unique Reach: Average Impression Frequency",
  "2026/09,111,Mabe_Drean_Lavado_Youtube_Trueview,3000,13.45678,1500,2.0",
  "2026/09,112,Mabe_Drean_Lavado_Youtube_Trueview,5,0.00004,4,1.25",
  "2026/10,221,Drean_Programmatic_CPM,1000,2,-,-",
  ",,,4005,15,1504,",
  "Report Time:,x,,,,,",
].join("\n");
const rN = aggReach(reCsv, "dv360_scheduled"), rS = appsScriptReach(parseCsv(reCsv));
ok(JSON.stringify(ord(rN.rows)) === JSON.stringify(ord(rS)), `reach = Apps Script\n${JSON.stringify(ord(rN.rows))}\n${JSON.stringify(ord(rS))}`);
ok(rN.rows.find((r) => r.mes === "2026-09-01")?.frequency === 1.25 && rN.rows.find((r) => r.mes === "2026-10-01")?.reach === 0, "reach: frecuencia = última fila; '-' = 0");

let tiro = false; try { aggCreatives("Foo,Bar\n1,2", "x"); } catch { tiro = true; }
ok(tiro, "header inesperado tira");

// ── Ventana de meses (hoy en AR) ──
const p = planMeses({ year: 2026, month: 10, day: 27 }, {});
ok(p.map((x) => x.mes).join() === "2026-08-01,2026-09-01,2026-10-01", "default 3 meses");
ok(p[0]!.hasta.day === 31 && p[1]!.hasta.day === 30 && p[1]!.cerrado && !p[2]!.cerrado && p[2]!.hasta.day === 26, "cerrados completos; en curso hasta ayer");
const p1 = planMeses({ year: 2026, month: 11, day: 1 }, { meses: 2 });
ok(p1.map((x) => x.mes).join() === "2026-10-01" && p1[0]!.cerrado && p1[0]!.hasta.day === 31, "día 1: el mes en curso no entra y el anterior queda cerrado");
const p2 = planMeses({ year: 2026, month: 1, day: 10 }, { desde: "2025-11" });
ok(p2.map((x) => x.mes).join() === "2025-11-01,2025-12-01,2026-01-01", "desde cruza el año");

// ── Guarda ──
const T = (i: number, r: number, f = 1) => ({ impresiones: i, revenue_usd: r, filas: f });
ok(decidirMes(T(1000, 100), T(1500, 150), false).accion === "escribir", "más datos → escribe");
ok(decidirMes(T(1000, 100), T(990, 99), false).accion === "escribir", "−1% (ruido) → escribe");
ok(decidirMes(T(1000, 100), T(970, 100), false).accion === "bloqueado", "−3% impresiones → bloqueado");
ok(decidirMes(T(1000, 100), T(1000, 90), false).accion === "bloqueado", "−10% inversión → bloqueado");
ok(decidirMes(T(1000, 100), T(500, 50), true).accion === "escribir", "force pisa");
ok(decidirMes(T(1000, 100), undefined, false).accion === "bloqueado", "API sin el mes y guardado con datos → bloqueado");
ok(decidirMes(undefined, undefined, false).accion === "sin_datos", "nada → sin_datos");
ok(decidirMes(undefined, T(10, 1), false).accion === "escribir", "mes nuevo → escribe");
const tot = totalesPorMes(nuestro.rows);
ok(tot.get("2026-09-01")?.impresiones === 6005 && tot.get("2026-09-01")?.filas === 2, "totalesPorMes");

console.log(`${pass} OK, ${fail} fallas`);
if (fail) process.exit(1);
