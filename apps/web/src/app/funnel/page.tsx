export const dynamic = "force-dynamic";

export default function BgtMktPage() {
  return (
    <div className="-m-6 h-[calc(100vh-2rem)]">
      <iframe
        src="/bgt-mkt/index.html"
        className="h-full w-full border-0"
        title="BGT Mkt Dashboard"
      />
    </div>
  );
}
