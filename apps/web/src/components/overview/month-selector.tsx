"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function MonthSelector({ months, current }: { months: string[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (mes: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", mes);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mes</label>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-md border bg-card px-3 py-1.5 text-sm font-medium"
      >
        {months.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
