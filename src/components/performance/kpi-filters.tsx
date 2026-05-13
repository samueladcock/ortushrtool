"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function KpiFilters({
  year,
  quarter,
  yearOptions,
}: {
  year: number;
  quarter: string;
  yearOptions: number[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const update = (key: "year" | "quarter", value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`?${next.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={String(year)}
        onChange={(e) => update("year", e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        value={quarter}
        onChange={(e) => update("quarter", e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      >
        <option value="all">All quarters</option>
        <option value="Q1">Q1 (Jan–Mar)</option>
        <option value="Q2">Q2 (Apr–Jun)</option>
        <option value="Q3">Q3 (Jul–Sep)</option>
        <option value="Q4">Q4 (Oct–Dec)</option>
      </select>
    </div>
  );
}
