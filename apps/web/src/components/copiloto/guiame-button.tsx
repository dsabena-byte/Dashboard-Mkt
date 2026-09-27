"use client";
import { pedirGuia, promptGuia, type GuiaItem } from "@/lib/copiloto-guia";

// Botón "Guiame paso a paso": abre el copiloto ("Preguntale a tus datos") con la pregunta ya armada
// (contexto del ítem + pedido de guía no técnica) y la envía sola. Evento `copiloto:ask`.
export function GuiameButton({ item, onBefore, className = "" }: { item: GuiaItem; /** Ej. cerrar el panel 🎓 antes de abrir el chat. */ onBefore?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onBefore?.();
        pedirGuia(promptGuia(item));
      }}
      title="Abre el copiloto y te explica, en palabras simples, cómo hacerlo, quién lo hace y cómo ver si funcionó"
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11.5px] font-semibold text-[#1e40af] transition-colors hover:border-[#1e40af] hover:bg-blue-100 ${className}`}
    >
      ✨ Guiame paso a paso
    </button>
  );
}
