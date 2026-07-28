"use client";

import { useState } from "react";

// Generador de Contenido UGC (persona hablando a cámara). Pipeline sobre fal.ai:
// guion (OpenAI) → retrato (fal imagen) → voz (ElevenLabs en fal) + video
// (OmniHuman). 3 perfiles con objetivo propio.

const PERFILES = [
  { key: "usuario", label: "Usuario", objetivo: "Testimonio de cliente · darkpost" },
  { key: "tecnico", label: "Técnico posventa", objetivo: "Recomendación con autoridad · darkpost" },
  { key: "personal", label: "Personal Drean", objetivo: "Humanización de marca · orgánico" },
];
const VOCES = [
  { key: "fem", label: "Voz femenina" },
  { key: "masc", label: "Voz masculina" },
];

function falErr(raw: string): string {
  if (/exhausted balance|user is locked|top up|402|insufficient/i.test(raw)) return "Sin créditos en fal.ai — recargá el saldo en fal.ai/dashboard/billing.";
  return raw;
}

export function UgcGenerator() {
  const [perfil, setPerfil] = useState("usuario");
  const [tema, setTema] = useState("");
  const [detalles, setDetalles] = useState("");
  const [voz, setVoz] = useState("fem");
  const [descPersona, setDescPersona] = useState("");

  const [guion, setGuion] = useState("");
  const [personaUrl, setPersonaUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState<"guion" | "persona" | "video" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generarGuion() {
    setBusy("guion"); setError(null);
    try {
      const r = await fetch("/api/ugc/guion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perfil, tema, detalles }) });
      const j = await r.json();
      if (j.ok) setGuion(j.guion); else setError(falErr(j.error ?? "?"));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  async function generarPersona() {
    setBusy("persona"); setError(null);
    try {
      const r = await fetch("/api/ugc/persona", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perfil, descripcion: descPersona }) });
      const j = await r.json();
      if (j.ok) { setPersonaUrl(j.image_url); setVideoUrl(null); } else setError(falErr(j.error ?? "?"));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  async function generarVideo() {
    if (!guion.trim() || !personaUrl) return;
    setBusy("video"); setError(null);
    try {
      const r = await fetch("/api/ugc/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guion, voz, persona_url: personaUrl }) });
      const j = await r.json();
      if (j.ok) setVideoUrl(j.video_url); else setError(falErr(j.error ?? "?"));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const perfilSel = PERFILES.find((p) => p.key === perfil)!;
  const field = "w-full rounded border px-3 py-2 text-sm";

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Panel de configuración */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Perfil</label>
          <div className="flex flex-wrap gap-2">
            {PERFILES.map((p) => (
              <button key={p.key} onClick={() => setPerfil(p.key)} className={`rounded-full border px-3 py-1 text-xs font-medium ${perfil === p.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>{p.label}</button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{perfilSel.objetivo}</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Producto / tema</label>
          <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej: Lavarropas Drean 12kg Eco Inverter" className={field} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Detalles a incluir (opcional)</label>
          <input value={detalles} onChange={(e) => setDetalles(e.target.value)} placeholder="Ej: bajo consumo, silencioso, garantía" className={field} />
        </div>

        <button onClick={generarGuion} disabled={busy !== null} className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy === "guion" ? "Generando guion…" : "1 · Generar guion"}
        </button>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Guion (editable)</label>
          <textarea value={guion} onChange={(e) => setGuion(e.target.value)} rows={5} placeholder="El guion generado aparece acá y lo podés editar." className={`${field} resize-y`} />
        </div>

        <div className="border-t pt-3">
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Persona (identidad)</label>
          <input value={descPersona} onChange={(e) => setDescPersona(e.target.value)} placeholder="Descripción opcional: edad, look, etc." className={`${field} mb-2`} />
          <button onClick={generarPersona} disabled={busy !== null} className="w-full rounded border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50">
            {busy === "persona" ? "Generando retrato…" : personaUrl ? "2 · Regenerar persona" : "2 · Generar persona"}
          </button>
        </div>

        <div className="border-t pt-3">
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Voz</label>
          <div className="mb-2 flex gap-2">
            {VOCES.map((v) => (
              <button key={v.key} onClick={() => setVoz(v.key)} className={`rounded-full border px-3 py-1 text-xs font-medium ${voz === v.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>{v.label}</button>
            ))}
          </div>
          <button onClick={generarVideo} disabled={busy !== null || !guion.trim() || !personaUrl} className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy === "video" ? "Generando video (1-3 min)…" : "3 · Generar video"}
          </button>
          {(!guion.trim() || !personaUrl) && <p className="mt-1 text-[11px] text-muted-foreground">Necesitás guion + persona para generar el video.</p>}
        </div>

        {error && <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Resultado</h3>
          {videoUrl ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={videoUrl} controls loop className="mx-auto max-h-[70vh] w-auto max-w-full rounded border" />
              <a href={videoUrl} target="_blank" rel="noopener" className="inline-block rounded border px-3 py-1 text-xs font-medium hover:bg-secondary">Abrir / descargar video</a>
            </div>
          ) : personaUrl ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={personaUrl} alt="persona" className="mx-auto max-h-[70vh] w-auto max-w-full rounded border" />
              <p className="text-xs text-muted-foreground">Retrato de la persona. Generá el video cuando tengas el guion listo.</p>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">Configurá el perfil y el tema a la izquierda, generá el guion y la persona, y después el video.</p>
          )}
        </div>

        <div className="rounded-lg border bg-secondary/40 p-3 text-[11px] text-muted-foreground">
          <strong>Cómo funciona:</strong> guion con OpenAI → voz rioplatense (ElevenLabs en fal.ai) → video de la persona hablando (OmniHuman en fal.ai). Todo con tu saldo de fal. Para <strong>darkpost</strong> (usuario/técnico), el video se arma en Meta/TikTok Ads Manager; el personal Drean es para orgánico.
        </div>
      </div>
    </div>
  );
}
