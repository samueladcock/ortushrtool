"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plane, Save, X } from "lucide-react";

type Props = {
  employeeId: string;
  availableTypes: { value: string; label: string }[];
};

export function LeaveRequestForm({ employeeId, availableTypes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    leave_type: availableTypes[0]?.value ?? "annual",
    leave_duration: "full_day" as "full_day" | "half_day",
    half_day_period: "am" as "am" | "pm",
    half_day_start_time: "",
    half_day_end_time: "",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const isHalfDay = form.leave_duration === "half_day";

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/leave-requests/for-employee", {
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
    setForm({ ...form, start_date: "", end_date: "", reason: "" });
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        <Plane size={12} /> Request time off
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Request time off</p>
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
        <Field label="Leave type">
          <select
            value={form.leave_type}
            onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
            className={inputClass}
          >
            {availableTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duration">
          <select
            value={form.leave_duration}
            onChange={(e) =>
              setForm({
                ...form,
                leave_duration: e.target.value as "full_day" | "half_day",
              })
            }
            className={inputClass}
          >
            <option value="full_day">Full day</option>
            <option value="half_day">Half day</option>
          </select>
        </Field>
        <Field label="Start date">
          <input
            type="date"
            value={form.start_date}
            onChange={(e) =>
              setForm({
                ...form,
                start_date: e.target.value,
                end_date: isHalfDay ? e.target.value : form.end_date,
              })
            }
            className={inputClass}
          />
        </Field>
        {!isHalfDay && (
          <Field label="End date">
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className={inputClass}
            />
          </Field>
        )}
        {isHalfDay && (
          <>
            <Field label="AM / PM">
              <select
                value={form.half_day_period}
                onChange={(e) =>
                  setForm({
                    ...form,
                    half_day_period: e.target.value as "am" | "pm",
                  })
                }
                className={inputClass}
              >
                <option value="am">Morning</option>
                <option value="pm">Afternoon</option>
              </select>
            </Field>
            <Field label="Start time">
              <input
                type="time"
                value={form.half_day_start_time}
                onChange={(e) =>
                  setForm({ ...form, half_day_start_time: e.target.value })
                }
                className={inputClass}
              />
            </Field>
            <Field label="End time">
              <input
                type="time"
                value={form.half_day_end_time}
                onChange={(e) =>
                  setForm({ ...form, half_day_end_time: e.target.value })
                }
                className={inputClass}
              />
            </Field>
          </>
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
          disabled={busy || !form.start_date}
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
