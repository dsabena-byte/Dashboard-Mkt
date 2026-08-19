import { DEMO } from "@/lib/demo/anonymize";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function BgtMktPage() {
  // En modo demo, el iframe anonimiza la categoría (ver public/bgt-mkt/index.html).
  const src = DEMO ? "/bgt-mkt/index.html?demo=1" : "/bgt-mkt/index.html";
  return (
    <div className="-mx-4 -my-4 h-[calc(100vh-2rem)] sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8">
      <iframe
        src={src}
        className="h-full w-full border-0"
        title="BGT Mkt Dashboard"
      />
    </div>
  );
}
