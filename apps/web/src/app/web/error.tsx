"use client";

import { useEffect } from "react";

export default function WebError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/web] server-side error:", error);
  }, [error]);

  return (
    <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-6">
      <div>
        <h2 className="text-lg font-semibold text-red-900">
          Error cargando el dashboard Web
        </h2>
        <p className="mt-1 text-sm text-red-700">
          Probá un rango de fechas más corto (≤ 30 días) mientras se resuelve. Si ves esto en
          rangos cortos, avisá.
        </p>
      </div>

      <div className="space-y-2 rounded border border-red-200 bg-white p-3 text-xs font-mono">
        <div>
          <span className="text-red-600">message:</span>{" "}
          <span className="text-slate-800">{error.message || "(sin mensaje)"}</span>
        </div>
        {error.digest && (
          <div>
            <span className="text-red-600">digest:</span>{" "}
            <span className="text-slate-800">{error.digest}</span>
          </div>
        )}
        {error.stack && (
          <details className="mt-2">
            <summary className="cursor-pointer text-red-600">stack trace</summary>
            <pre className="mt-2 whitespace-pre-wrap text-[10px] text-slate-700">
              {error.stack}
            </pre>
          </details>
        )}
      </div>

      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
      >
        Reintentar
      </button>
    </div>
  );
}
