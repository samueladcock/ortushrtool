"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCog, Save, X } from "lucide-react";
import type { ScheduleAdjustmentType, WorkLocation } from "@/types/database";

export function ScheduleChangeForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    requested_date: "",
    adjustment_type: "time" as ScheduleAdjustmentType,
    requested_start_time: "",
    requested_end_time: "",
    requested_work_location: "office" as WorkLocation,
    reason: "",
  });

  const showTime =
    form.adjustment_type === "time" || form.adjustment_type === "both";
  const showLoc =
    form.adjustment_type === "location" || form.adjustment_type === "both";

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/schedule-adjustments/for-employee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employeeId,
        ...form,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Submit failed");
      return;
    }
    setOpen(false);
    setForm({
      requested_date: "",
      adjustment_type: "time",
      requested_start_time: "",
      requested_end_time: "",
      requested_work_location: "office",
      reason: "",
    });
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        <CalendarCog size={12} /> Request schedule change
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Request schedule change</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-gray-500 hover:bg-gray-100"
        >
          <X size={14} />
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <input
            type="date"
            value={form.requested_date}
            onChange={(e) =>
              setForm({ ...form, requested_date: e.target.value })
            }
            className={inputClass}
          />
        </Field>
        <Field label="Change type">
          <select
            value={form.adjustment_type}
            onChange={(e) =>
              setForm({
                ...form,
                adjustment_type: e.target.value as ScheduleAdjustmentType,
              })
            }
            className={inputClass}
          >
            <option value="time">Time</option>
            <option value="location">Working Location</option>
            <option value="both">Both</option>
          </select>
        </Field>
        {showTime && (
          <>
            <Field label="New start time">
              <input
                type="time"
                value={form.requested_start_time}
                onChange={(e) =>
                  setForm({ ...form, requested_start_time: e.target.value })
                }
                className={inputClass}
              />
            </Field>
            <Field label="New end time">
              <input
                type="time"
                value={form.requested_end_time}
                onChange={(e) =>
                  setForm({ ...form, requested_end_time: e.target.value })
                }
                className={inputClass}
              />
            </Field>
          </>
        )}
        {showLoc && (
          <Field label="New location">
            <select
              value={form.requested_work_location}
              onChange={(e) =>
                setForm({
                  ...form,
                  requested_work_location: e.target.value as WorkLocation,
                })
              }
              className={inputClass}
            >
              <option value="office">Office</option>
              <option value="online">Online</option>
            </select>
          </Field>
        )}
        <Field label="Reason" full>
          <textarea
            rows={2}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !form.requested_date}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={12} /> {busy ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}
