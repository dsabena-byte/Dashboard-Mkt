# Market Intelligence 2026 — procesa el extracto de mercado_share (GfK) y arma datos/mercado.json.
# Uso: python3 analisis.py   (lee datos/mercado_share-2026-10-19.json, extracto REST del 19-oct-2026)
import json, collections as C, os
D = os.path.dirname(os.path.abspath(__file__))
rows = json.load(open(f"{D}/datos/mercado_share-2026-10-19.json"))
CATS = ["Lavado", "Refrigeración", "Cocción"]
SEGS = ["Low", "Mid", "High"]
KS = {"us": "unit_share", "vs": "value_share", "pi": "index_price"}
g = C.defaultdict(dict)
for r in rows:
    if r["mes"] > "2026-07-01":  # MAT nov-26 = proyección cargada a futuro; no es dato real
        continue
    g[(r["categoria"], r["segmento"], r["agregacion"], r["mes"])][r["marca"]] = r

def val(cat, seg, ag, mes, marca, k):
    r = g.get((cat, seg, ag, mes), {}).get(marca)
    return None if r is None else r[KS[k]]

def d(a, b, nd=1):
    return None if a is None or b is None else round(a - b, nd)

def m(y, i): return f"{y}-{i+1:02d}-01"

REF, REF_PREV, DIC = "2026-07-01", "2025-07-01", "2025-12-01"
out = {"lectura": "2026-10-19", "ultimo_mes": "2026-07", "categorias": {}}
for cat in CATS:
    T = g[(cat, "Total", "MAT", REF)]
    marcas = sorted(T, key=lambda b: -(T[b]["unit_share"] or 0))
    c = {"marcas": marcas}
    # Serie mensual ene–dic 2026 y 2025 (Total)
    c["mensual"] = {b: {k: {str(y): [val(cat, "Total", "mensual", m(y, i), b, k) for i in range(12)] for y in (2025, 2026)} for k in KS} for b in marcas}
    # MAT histórico
    mats = sorted({k[3] for k in g if k[0] == cat and k[1] == "Total" and k[2] == "MAT" and k[3] >= "2024-01-01"})
    c["mat_meses"] = mats
    c["mat"] = {b: {k: [val(cat, "Total", "MAT", x, b, k) for x in mats] for k in KS} for b in marcas}
    # Tabla de Drean y ranking de competidores
    def fila(b, seg="Total"):
        f = {}
        for k in KS:
            mj, mj5, md = (val(cat, seg, "mensual", x, b, k) for x in (REF, REF_PREV, DIC))
            aj, aj5, ad = (val(cat, seg, "MAT", x, b, k) for x in (REF, REF_PREV, DIC))
            f[k] = {"jul26": mj, "jul25": mj5, "d_jul25": d(mj, mj5), "dic25": md, "d_dic25": d(mj, md),
                    "mat26": aj, "mat25": aj5, "d_mat": d(aj, aj5), "matdic": ad, "d_matdic": d(aj, ad)}
        return f
    c["tabla"] = {b: fila(b) for b in marcas}
    # Segmentos: Drean, líder y share de cada marca por segmento
    c["segmentos"] = {}
    for seg in SEGS:
        S = g[(cat, seg, "MAT", REF)]
        ms = sorted(S, key=lambda b: -(S[b]["unit_share"] or 0))
        c["segmentos"][seg] = {"marcas": ms, "tabla": {b: fila(b, seg) for b in ms},
                               "drean_mensual": {k: [val(cat, seg, "mensual", m(2026, i), "DREAN", k) for i in range(12)] for k in KS},
                               "drean_mensual_2025": {k: [val(cat, seg, "mensual", m(2025, i), "DREAN", k) for i in range(12)] for k in KS}}
    out["categorias"][cat] = c

# Validación: Price Index (unidades) vs value share ÷ unit share × 100 (identidad)
dif = [r["index_price"] - 100 * r["value_share"] / r["unit_share"] for r in rows
       if r["unit_share"] and r["value_share"] and r["index_price"] and r["unit_share"] > 2 and r["mes"] >= "2025-07-01"]
dif.sort()
out["validacion"] = {"filas": len(rows), "pi_identidad_n": len(dif), "pi_identidad_mediana": dif[len(dif)//2],
                     "pi_identidad_p90_abs": sorted(abs(x) for x in dif)[int(len(dif)*.9)]}
json.dump(out, open(f"{D}/datos/mercado.json", "w"), ensure_ascii=False, indent=0)

# Self-check: shares mensuales del Total suman ~100 en 2026
for cat in CATS:
    for i in range(7):
        s = sum(r["unit_share"] or 0 for r in g[(cat, "Total", "mensual", m(2026, i))].values())
        assert abs(s - 100) < 1, (cat, i, s)
print("ok", {c: out["categorias"][c]["tabla"]["DREAN"]["us"]["mat26"] for c in CATS}, out["validacion"])
