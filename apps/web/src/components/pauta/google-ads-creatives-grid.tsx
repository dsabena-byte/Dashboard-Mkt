"use client";

import { useMemo, useState, useEffect } from "react";
import type { GoogleAdsCreativeRow } from "@/lib/google-ads-creatives-queries";
import { formatCurrency, formatNumber } from "@/lib/utils";

// Grilla de piezas de Google Ads a nivel anuncio (Demand Gen / Search / Video),
// con embudo de video (cuartiles). Mirrorea la de Meta (meta-paid-grid) pero con
// las columnas de google_ads_creatives (cost, campaign_type, account_label).

const PAGE_SIZE = 12;
const fmtNum = (n: number) => formatNumber(Math.round(n));

const TIPO_LABEL: Record<string, string> = {
  DEMAND_GEN: "Demand Gen",
  SEARCH: "Search",
  VIDEO: "Video",
  PERFORMANCE_MAX: "PMax",
  MULTI_CHANNEL: "Multicanal",
};
const TIPO_COLOR: Record<string, string> = {
  DEMAND_GEN: "#34A853",
  SEARCH: "#FBBC05",
  VIDEO: "#EA4335",
  PERFORMANCE_MAX: "#4285F4",
};

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function GoogleAdsCreativesGrid({ data, selMeses, selCats }: { data: GoogleAdsCreativeRow[]; selMeses: string[]; selCats: string[] }) {
  const filtered = useMemo(
    () =>
      data.filter(
        (r) =>
          r.impressions > 0 &&
          (selMeses.length === 0 || selMeses.includes(r.mes)) &&
          (selCats.length === 0 || (r.account_label != null && selCats.includes(r.account_label))),
      ),
    [data, selMeses, selCats],
  );

  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => setShown(PAGE_SIZE), [selMeses, selCats]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Sin piezas de Google Ads para el filtro seleccionado.
      </div>
    );
  }

  const page = filtered.slice(0, shown);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {page.map((r) => {
          const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
          const cpc = r.clicks > 0 ? r.cost / r.clicks : 0;
          const hasVideo = r.vtr_p25 != null;
          const tipo = r.campaign_type ?? "";
          return (
            <div key={`${r.ad_id}-${r.mes}`} className="flex flex-col rounded-xl border bg-card p-3">
              <div className="mb-2 flex flex-wrap items-center gap-1">
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white" style={{ backgroundColor: TIPO_COLOR[tipo] ?? "#94a3b8" }}>
                  {TIPO_LABEL[tipo] ?? (tipo || "—")}
                </span>
                {r.account_label && <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-secondary-foreground">{r.account_label}</span>}
                <span className="ml-auto text-[9px] text-muted-foreground">{r.mes}</span>
              </div>

              {r.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumbnail_url} alt={r.ad_name ?? ""} className="mb-2 h-32 w-full rounded object-cover" loading="lazy" />
              ) : (
                <div className="mb-2 flex h-16 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">sin miniatura</div>
              )}

              <div className="mb-2 min-w-0">
                <div className="truncate text-xs font-semibold" title={r.ad_name ?? ""}>{truncate(r.ad_name, 46) || r.ad_id}</div>
                {r.campaign_name && <div className="truncate text-[10px] text-muted-foreground" title={r.campaign_name}>{truncate(r.campaign_name, 52)}</div>}
              </div>

              <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[10px]">
                <Metric label="Inv." value={formatCurrency(r.cost)} />
                <Metric label="Impr." value={fmtNum(r.impressions)} />
                <Metric label="Clicks" value={fmtNum(r.clicks)} />
                <Metric label="CTR" value={`${ctr.toFixed(2)}%`} />
                <Metric label="CPC" value={formatCurrency(cpc)} />
                <Metric label="Interac." value={fmtNum(r.interactions)} />
              </div>

              {hasVideo && (
                <div className="mt-2 border-t pt-2">
                  <div className="mb-1 text-[9px] uppercase tracking-wide text-muted-foreground">Embudo de video (VTR)</div>
                  <div className="flex items-end gap-1">
                    {([["25%", r.vtr_p25], ["50%", r.vtr_p50], ["75%", r.vtr_p75], ["100%", r.vtr_p100]] as Array<[string, number | null]>).map(([lbl, v]) => {
                      const pct = (v ?? 0) * 100;
                      return (
                        <div key={lbl} className="flex-1">
                          <div className="flex h-8 items-end overflow-hidden rounded bg-muted">
                            <div className="w-full bg-[#34A853]/80" style={{ height: `${Math.min(100, pct)}%` }} />
                          </div>
                          <div className="mt-0.5 text-center text-[8px] tabular-nums text-muted-foreground">{lbl}·{pct.toFixed(0)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {shown < filtered.length && (
        <div className="mt-3 text-center">
          <button onClick={() => setShown((s) => s + PAGE_SIZE)} className="rounded border px-3 py-1 text-xs font-medium hover:bg-secondary">
            Mostrar más ({filtered.length - shown} restantes)
          </button>
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
