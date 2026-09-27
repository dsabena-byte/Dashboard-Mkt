import { cargarRevision } from "@/lib/chat/feedback-server";
import { peoresRespuestas, resumenFeedback } from "@/lib/chat/verified";
import { CopilotoCalidad } from "@/components/copiloto/copiloto-calidad";

// Calidad del copiloto (portado de BIP, sep-2026; en Drean no hay staff: la revisa quien tiene acceso a
// /copiloto por dashboard_access — el middleware ya redirige a los restringidos). Muestra los 👍/👎 de
// "Preguntale a tus datos" (últimos 90 días), las PEORES respuestas primero (sin revisar, "dato
// incorrecto" y con comentario arriba) y las respuestas VERIFICADAS que el copiloto reusa como ejemplo
// de método en preguntas parecidas (lib/chat/verified.ts). Tablas: migración 0120.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const DIAS = 90;

export default async function CopilotoPage() {
  const data = await cargarRevision(DIAS).catch(() => ({ disponible: false, feedback: [], verificadas: [] }));
  const resumen = resumenFeedback(data.feedback);
  const peores = peoresRespuestas(data.feedback, 40);
  const positivas = data.feedback.filter((r) => r.rating > 0).slice(0, 20);
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Calidad del copiloto</h2>
        <p className="text-sm text-muted-foreground">
          Lo que el equipo calificó en “Preguntale a tus datos”. Revisá las peores respuestas y verificá las buenas (o corregidas): el copiloto las usa como ejemplo de método en preguntas parecidas, y siempre vuelve a consultar los números.
        </p>
      </header>
      {!data.disponible && (
        <p className="rounded-md border px-3 py-2 text-xs" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
          Falta correr la migración <code>0120_copiloto_feedback.sql</code> en el SQL Editor de Supabase. Hasta entonces los 👍/👎 se muestran en el chat pero no se guardan.
        </p>
      )}
      <CopilotoCalidad resumen={resumen} peores={peores} positivas={positivas} verificadas={data.verificadas} dias={DIAS} />
    </div>
  );
}
