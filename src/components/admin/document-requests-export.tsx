"use client";

import { Download } from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentRequestWithEmployee,
} from "@/types/database";
import { displayName } from "@/lib/utils";

const HEADERS = [
  "Submitted",
  "Employee",
  "Email",
  "Document Type",
  "Custom Document Name",
  "Addressee",
  "Event Tag",
  "Event Name",
  "Event City",
  "Event Country",
  "Event Date",
  "Leave From",
  "Leave To",
  "Additional Details",
  "Status",
  "Processed By",
  "Processed At",
  "HR Notes",
  "Attachment URL",
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function DocumentRequestsExport({
  requests,
  filterLabel,
}: {
  requests: DocumentRequestWithEmployee[];
  /** Used in the downloaded filename, e.g. "all" or "certificate-of-employment". */
  filterLabel?: string;
}) {
  const handleDownload = () => {
    const rows = requests.map((r) => [
      r.created_at?.slice(0, 19).replace("T", " ") ?? "",
      r.employee ? displayName(r.employee) : "",
      r.employee?.email ?? "",
      r.document_type === "other"
        ? "Other"
        : DOCUMENT_TYPE_LABELS[r.document_type],
      r.custom_document_name ?? "",
      r.addressee,
      r.event_tag ?? "",
      r.event_name ?? "",
      r.event_city ?? "",
      r.event_country ?? "",
      r.event_date ?? "",
      r.leave_start_date ?? "",
      r.leave_end_date ?? "",
      r.additional_details ?? "",
      r.status,
      r.processor ? displayName(r.processor) : "",
      r.processed_at?.slice(0, 19).replace("T", " ") ?? "",
      r.processor_notes ?? "",
      r.processor_attachment_url ?? "",
    ]);

    const csv = [HEADERS, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `document-requests-${filterLabel ?? "all"}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={requests.length === 0}
      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      <Download size={14} />
      Export CSV ({requests.length})
    </button>
  );
}
