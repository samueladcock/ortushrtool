"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { displayName } from "@/lib/utils";

export type FlagRow = {
  id: string;
  flag_type: string;
  flag_date: string;
  deviation_minutes: number;
  scheduled_time: string;
  actual_time: string | null;
  acknowledged: boolean;
  notes: string | null;
  employee_notes: string | null;
  employee?: {
    full_name?: string | null;
    preferred_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
};

const HEADERS = [
  "Date",
  "Employee",
  "Email",
  "Flag Type",
  "Scheduled Time",
  "Actual Time",
  "Deviation (minutes)",
  "Status",
  "Manager Note",
  "Employee Note",
];

const FLAG_TYPE_LABELS: Record<string, string> = {
  late_arrival: "Late Arrival",
  early_departure: "Early Departure",
  absent: "Absent",
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function FlagsExport({
  fetchFlags,
}: {
  /** Returns the full set of flags to export, post all active filters. */
  fetchFlags: () => Promise<FlagRow[]>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    let flags: FlagRow[] = [];
    try {
      flags = await fetchFlags();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setLoading(false);
      return;
    }
    if (flags.length === 0) {
      setError("No flags match the current filters.");
      setLoading(false);
      return;
    }

    const rows = flags.map((f) => [
      f.flag_date,
      f.employee ? displayName(f.employee) : "",
      f.employee?.email ?? "",
      FLAG_TYPE_LABELS[f.flag_type] ?? f.flag_type,
      f.scheduled_time ?? "",
      f.actual_time ?? "",
      f.deviation_minutes ?? "",
      f.acknowledged ? "Acknowledged" : "Pending",
      f.notes ?? "",
      f.employee_notes ?? "",
    ]);

    const csv = [HEADERS, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flags-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        <Download size={14} />
        {loading ? "Preparing..." : "Export CSV"}
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
