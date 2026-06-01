export const dynamic = "force-dynamic";

export default function BgtMktPage() {
  return (
    <div className="-mx-4 -my-4 h-[calc(100vh-2rem)] sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8">
      <iframe
        src="/bgt-mkt/index.html"
        className="h-full w-full border-0"
        title="BGT Mkt Dashboard"
      />
    </div>
  );
}
