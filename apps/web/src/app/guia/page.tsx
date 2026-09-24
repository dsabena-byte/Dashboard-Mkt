import Link from "next/link";
import {
  MODULOS, textoBusqueda, ETAPAS, NIVELES, FUNNELS, PLATAFORMAS,
  type Etapa, type Nivel, type Funnel, type Plataforma,
} from "@/lib/guia";
import { GuiaExplorer, type GuiaCard, type GuiaFiltros } from "./_components/guia-explorer";

// Método BIP (portado de BIP, sep-2026) — el método que ordena la plataforma. Contenido
// estático (lib/guia, sin DB); los filtros iniciales vienen por query (?etapa=aprender&…)
// para poder linkear desde los tableros.
export const metadata = { title: "Método BIP" };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

export default function Guia({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const one = (k: string) => {
    const v = searchParams?.[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const initial: GuiaFiltros = {
    etapa: pick<Etapa>(one("etapa"), ETAPAS),
    nivel: pick<Nivel>(one("nivel"), NIVELES),
    funnel: pick<Funnel>(one("funnel"), FUNNELS),
    plataforma: pick<Plataforma>(one("plataforma"), PLATAFORMAS),
    q: one("q")?.slice(0, 80),
  };
  const cards: GuiaCard[] = MODULOS.map((m) => ({
    id: m.id,
    titulo: m.titulo,
    resumen: m.resumen,
    nivel: m.nivel,
    etapa: m.etapa,
    funnel: m.funnel,
    plataforma: m.plataforma,
    buscar: norm(textoBusqueda(m)),
  }));

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Método BIP</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          El método con el que funciona la plataforma:{" "}
          <b className="font-semibold text-slate-900">datos → aprendizaje → decisiones → resultados</b>, en ciclos de tres meses. De la
          estrategia al paso a paso en cada plataforma, siempre conectado a los tableros.{" "}
          <Link href="/guia/metodo-bip" className="whitespace-nowrap font-semibold text-[#1e40af] hover:underline">
            Cómo funciona el ciclo
          </Link>
        </p>
      </header>
      <GuiaExplorer cards={cards} initial={initial} />
    </div>
  );
}
