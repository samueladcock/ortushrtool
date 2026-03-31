"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export function AdminAdjustmentForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dates, setDates] = useState<string[]>([""]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  const addDate = () => setDates([...dates, ""]);
  const removeDate = (idx: number) =>
    setDates(dates.filter((_, i) => i !== idx));
  const updateDate = (idx: number, value: string) =>
    setDates(dates.map((d, i) => (i === idx ? value : d)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validDates = dates.filter((d) => d);
    if (validDates.length === 0) {
      setMessage("Please select at least one date.");
      return;
    }
    if (!startTime || !endTime) {
      setMessage("Please set start and end times.");
      return;
    }

    setSaving(true);
    setMessage("");
    const supabase = createClient();

    let errors = 0;

    for (const date of validDates) {
      const dateObj = new Date(date);
      const dayOfWeek = (dateObj.getDay() + 6) % 7;

      // Get current schedule for that day
      const { data: schedule } = await supabase
        .from("schedules")
        .select("start_time, end_time")
        .eq("employee_id", userId)
        .eq("day_of_week", dayOfWeek)
        .lte("effective_from", date)
        .or(`effective_until.is.null,effective_until.gte.${date}`)
        .limit(1)
        .maybeSingle();

      const { error } = await supabase
        .from("schedule_adjustments")
        .insert({
          employee_id: userId,
          requested_date: date,
          original_start_time: schedule?.start_time ?? "09:00",
          original_end_time: schedule?.end_time ?? "18:00",
          requested_start_time: startTime,
          requested_end_time: endTime,
          reason: reason || "Admin adjustment",
          status: "approved",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
        });

      if (error) errors++;
    }

    if (errors > 0) {
      setMessage(`Created with ${errors} error(s).`);
    } else {
      setMessage(
        `Adjustment added for ${validDates.length} date(s) — auto-approved.`
      );
      setDates([""]);
      setStartTime("");
      setEndTime("");
      setReason("");
    }

    setSaving(false);
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white p-6 space-y-4"
    >
      <p className="text-sm text-gray-600">
        Add a one-off schedule change for specific dates. This will be
        auto-approved as an admin override.
      </p>

      {/* Dates */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date(s)
        </label>
        <div className="space-y-2">
          {dates.map((date, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => updateDate(idx, e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {dates.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDate(idx)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addDate}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} />
            Add another date
          </button>
        </div>
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Start time
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            End time
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Reason (optional)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Training day, client meeting..."
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.includes("error")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Add Adjustment"}
      </button>
    </form>
  );
}
