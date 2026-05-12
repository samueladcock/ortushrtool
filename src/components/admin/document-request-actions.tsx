"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, RotateCcw } from "lucide-react";

export function DocumentRequestActions({
  requestId,
  currentStatus,
}: {
  requestId: string;
  currentStatus: "pending" | "processed" | "cancelled";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [error, setError] = useState("");

  const updateStatus = async (
    status: "pending" | "processed",
    extra?: { notes?: string | null; attachmentUrl?: string | null }
  ) => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: updateError } = await supabase
      .from("document_requests")
      .update({
        status,
        processed_by: status === "processed" ? user?.id : null,
        processed_at: status === "processed" ? new Date().toISOString() : null,
        processor_notes: extra?.notes ?? null,
        processor_attachment_url: extra?.attachmentUrl ?? null,
      })
      .eq("id", requestId);
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    setShowForm(false);
    setNotes("");
    setAttachmentUrl("");
    router.refresh();
  };

  if (showForm) {
    const url = attachmentUrl.trim();
    const isValidUrl =
      !url || /^https?:\/\//i.test(url);
    return (
      <div className="flex w-72 flex-col gap-2">
        <input
          type="url"
          value={attachmentUrl}
          onChange={(e) => setAttachmentUrl(e.target.value)}
          placeholder="Attachment link (https://...)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {!isValidUrl && (
          <p className="text-[11px] text-red-600">
            Link must start with http:// or https://
          </p>
        )}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note for the employee..."
          rows={2}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() =>
              updateStatus("processed", {
                notes: notes.trim() || null,
                attachmentUrl: url || null,
              })
            }
            disabled={loading || !isValidUrl}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "..." : "Confirm Processed"}
          </button>
          <button
            onClick={() => {
              setShowForm(false);
              setError("");
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (currentStatus === "processed") {
    return (
      <button
        onClick={() => updateStatus("pending", {})}
        disabled={loading}
        className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        <RotateCcw size={14} />
        Reopen
      </button>
    );
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      <Check size={14} />
      Mark Processed
    </button>
  );
}
