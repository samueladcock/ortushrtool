"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Send } from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentRequestType,
} from "@/types/database";

const DOCUMENT_OPTIONS: DocumentRequestType[] = [
  "certificate_of_employment",
  "purpose_of_travel",
  "leave_certificate",
  "contract_copy",
  "other",
];

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function DocumentRequestForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [documentType, setDocumentType] =
    useState<DocumentRequestType>("certificate_of_employment");
  const [customDocumentName, setCustomDocumentName] = useState("");
  const [addressee, setAddressee] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");

  // Purpose of Travel
  const [eventTag, setEventTag] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventCountry, setEventCountry] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventName, setEventName] = useState("");

  // Leave Certificate
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    if (!addressee.trim()) {
      setError("Addressee is required.");
      setSubmitting(false);
      return;
    }

    if (documentType === "other" && !customDocumentName.trim()) {
      setError("Please specify the document you need.");
      setSubmitting(false);
      return;
    }

    if (documentType === "purpose_of_travel") {
      if (!eventName.trim() || !eventDate || !eventCity.trim() || !eventCountry.trim()) {
        setError("Please fill in event name, date, city, and country.");
        setSubmitting(false);
        return;
      }
    }

    if (documentType === "leave_certificate") {
      if (!leaveStart || !leaveEnd) {
        setError("Please provide the leave start and end dates.");
        setSubmitting(false);
        return;
      }
      if (leaveEnd < leaveStart) {
        setError("Leave end date must be on or after the start date.");
        setSubmitting(false);
        return;
      }
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSubmitting(false);
      return;
    }

    const row = {
      employee_id: user.id,
      document_type: documentType,
      custom_document_name:
        documentType === "other" ? customDocumentName.trim() : null,
      addressee: addressee.trim(),
      additional_details: additionalDetails.trim() || null,
      event_tag: documentType === "purpose_of_travel" ? eventTag.trim() || null : null,
      event_city: documentType === "purpose_of_travel" ? eventCity.trim() : null,
      event_country:
        documentType === "purpose_of_travel" ? eventCountry.trim() : null,
      event_date: documentType === "purpose_of_travel" ? eventDate : null,
      event_name: documentType === "purpose_of_travel" ? eventName.trim() : null,
      leave_start_date:
        documentType === "leave_certificate" ? leaveStart : null,
      leave_end_date: documentType === "leave_certificate" ? leaveEnd : null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("document_requests")
      .insert(row)
      .select("id")
      .single();

    if (insertError || !inserted) {
      setError(insertError?.message || "Failed to submit.");
      setSubmitting(false);
      return;
    }

    try {
      await fetch("/api/notifications/document-request-submitted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_request_id: inserted.id }),
      });
    } catch {
      // Non-blocking — request is saved either way
    }

    router.push("/documents");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-gray-200 bg-white p-6"
    >
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className={labelClass}>Document type</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as DocumentRequestType)}
          className={inputClass}
        >
          {DOCUMENT_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {documentType === "other" && (
        <div>
          <label className={labelClass}>What document do you need?</label>
          <input
            type="text"
            required
            value={customDocumentName}
            onChange={(e) => setCustomDocumentName(e.target.value)}
            placeholder="e.g. Tax Identification Letter"
            className={inputClass}
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Addressee</label>
        <input
          type="text"
          required
          value={addressee}
          onChange={(e) => setAddressee(e.target.value)}
          placeholder='e.g. "To Whom It May Concern", a specific embassy, a bank, etc.'
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-400">
          Who is this document being addressed to?
        </p>
      </div>

      {documentType === "purpose_of_travel" && (
        <div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Travel details
          </p>
          <div>
            <label className={labelClass}>Event name</label>
            <input
              type="text"
              required
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Event tag</label>
            <input
              type="text"
              value={eventTag}
              onChange={(e) => setEventTag(e.target.value)}
              placeholder="e.g. Conference, Client Meeting"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>City</label>
              <input
                type="text"
                required
                value={eventCity}
                onChange={(e) => setEventCity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input
                type="text"
                required
                value={eventCountry}
                onChange={(e) => setEventCountry(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Date of the event</label>
            <input
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {documentType === "leave_certificate" && (
        <div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Leave range
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>From</label>
              <input
                type="date"
                required
                value={leaveStart}
                onChange={(e) => setLeaveStart(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>To</label>
              <input
                type="date"
                required
                value={leaveEnd}
                onChange={(e) => setLeaveEnd(e.target.value)}
                min={leaveStart || undefined}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>Additional details</label>
        <textarea
          rows={4}
          value={additionalDetails}
          onChange={(e) => setAdditionalDetails(e.target.value)}
          placeholder="Anything else HR should know to prepare this document..."
          className={inputClass}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={14} />
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </form>
  );
}
