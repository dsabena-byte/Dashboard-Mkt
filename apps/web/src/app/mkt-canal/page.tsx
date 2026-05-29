export const dynamic = "force-dynamic";

export default function MktCanalPage() {
  return (
    <div className="-m-6 h-[calc(100vh-2rem)]">
      <iframe
        src="/mkt-canal/index.html"
        className="h-full w-full border-0"
        title="Mkt Canal Dashboard"
      />
    </div>
  );
}
