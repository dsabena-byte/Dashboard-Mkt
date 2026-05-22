export const dynamic = "force-dynamic";

const EXTERNAL_URL = "https://cuadros-basicos.vercel.app/";

export default function FloorSharePage() {
  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-3">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Floor Share</h2>
          <p className="text-sm text-muted-foreground">
            Share de góndola por categoría · Ranking de marcas · Evolución mensual.
            <span className="ml-2 italic">→ Click en la tab &quot;Floor Share&quot; dentro del dashboard.</span>
          </p>
        </div>
        <a
          href={EXTERNAL_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60"
        >
          Abrir en nueva pestaña ↗
        </a>
      </header>
      <iframe
        src={EXTERNAL_URL}
        title="Floor Share — Trade Marketing"
        className="h-full w-full flex-1 rounded-lg border bg-card"
        allow="fullscreen"
      />
    </div>
  );
}
