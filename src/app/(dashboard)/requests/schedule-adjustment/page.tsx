"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";
import type { ScheduleAdjustmentType, WorkLocation } from "@/types/database";

export default function ScheduleAdjustmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPermanent, setIsPermanent] = useState(false);

  const [dates, setDates] = useState<string[]>([""]);
  const [adjustmentType, setAdjustmentType] = useState<ScheduleAdjustmentType>("time");
  const [requestedStart, setRequestedStart] = useState("");
  const [requestedEnd, setRequestedEnd] = useState("");
  const [requestedLocation, setRequestedLocation] = useState<WorkLocation>("office");
  const [reason, setReason] = useState("");

  const addDate = () => setDates([...dates, ""]);
  const removeDate = (idx: number) =>
    setDates(dates.filter((_, i) => i !== idx));
  const updateDate = (idx: number, value: string) =>
    setDates(dates.map((d, i) => (i === idx ? value : d)));

  const showTimeFields = adjustmentType === "time" || adjustmentType === "both";
  const showLocationField = adjustmentType === "location" || adjustmentType === "both";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const validDates = dates.filter((d) => d);
    if (!isPermanent && validDates.length === 0) {
      setError("Please select at least one date.");
      setLoading(false);
      return;
    }

    if (showTimeFields && (!requestedStart || !requestedEnd)) {
      setError("Please set start and end times.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    if (isPermanent) {
      // Permanent change: update the base schedule for all weekdays
      const today = new Date().toISOString().split("T")[0];

      for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
        const { data: existing } = await supabase
          .from("schedules")
          .select("id")
          .eq("employee_id", user.id)
          .eq("day_of_week", dayIdx)
          .lte("effective_from", today)
          .or(`effective_until.is.null,effective_until.gte.${today}`)
          .limit(1)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("schedules")
            .update({ effective_until: today })
            .eq("id", existing.id);
        }
      }

      const { error: insertError } = await supabase
        .from("schedule_adjustments")
        .insert({
          employee_id: user.id,
          requested_date: "9999-12-31",
          adjustment_type: adjustmentType,
          original_start_time: "00:00",
          original_end_time: "00:00",
          requested_start_time: showTimeFields ? requestedStart : "00:00",
          requested_end_time: showTimeFields ? requestedEnd : "00:00",
          requested_work_location: showLocationField ? requestedLocation : null,
          reason: `[PERMANENT CHANGE] ${reason}`,
        });

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }
    } else {
      // Temporary: create an adjustment for each selected date
      for (const date of validDates) {
        const dateObj = new Date(date);
        const dayOfWeek = (dateObj.getDay() + 6) % 7;

        const { data: schedule } = await supabase
          .from("schedules")
          .select("start_time, end_time")
          .eq("employee_id", user.id)
          .eq("day_of_week", dayOfWeek)
          .lte("effective_from", date)
          .or(`effective_until.is.null,effective_until.gte.${date}`)
          .limit(1)
          .maybeSingle();

        const originalStart = schedule?.start_time ?? "09:00";
        const originalEnd = schedule?.end_time ?? "18:00";

        const { error: insertError } = await supabase
          .from("schedule_adjustments")
          .insert({
            employee_id: user.id,
            requested_date: date,
            adjustment_type: adjustmentType,
            original_start_time: originalStart,
            original_end_time: originalEnd,
            requested_start_time: showTimeFields ? requestedStart : originalStart,
            requested_end_time: showTimeFields ? requestedEnd : originalEnd,
            requested_work_location: showLocationField ? requestedLocation : null,
            reason,
          });

        if (insertError) {
          setError(insertError.message);
          setLoading(false);
          return;
        }
      }
    }

    // Notify manager
    try {
      await fetch("/api/notifications/adjustment-submitted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_date: isPermanent
            ? "Permanent change"
            : validDates.join(", "),
          original_time: "Current schedule",
          requested_time: showTimeFields
            ? `${requestedStart} - ${requestedEnd}`
            : "No time change",
          requested_location: showLocationField ? requestedLocation : null,
          adjustment_type: adjustmentType,
          reason: isPermanent ? `[PERMANENT] ${reason}` : reason,
        }),
      });
    } catch {
      // Non-blocking
    }

    router.push("/requests");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/requests"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} />
          Back to Requests
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Request Schedule Adjustment
        </h1>
        <p className="text-gray-600">
          Request a change to your working hours or location.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-6"
      >
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Permanent or temporary */}
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">
            Is this a permanent change or just for specific dates?
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="duration_type"
                checked={!isPermanent}
                onChange={() => setIsPermanent(false)}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Specific dates</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="duration_type"
                checked={isPermanent}
                onChange={() => setIsPermanent(true)}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">
                Permanently change my schedule
              </span>
            </label>
          </div>
        </div>

        {/* What are you changing? */}
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">
            What would you like to change?
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="adjustment_type"
                checked={adjustmentType === "time"}
                onChange={() => setAdjustmentType("time")}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Time</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="adjustment_type"
                checked={adjustmentType === "location"}
                onChange={() => setAdjustmentType("location")}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Location</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="adjustment_type"
                checked={adjustmentType === "both"}
                onChange={() => setAdjustmentType("both")}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Both</span>
            </label>
          </div>
        </div>

        {/* Date selection (only for temporary) */}
        {!isPermanent && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Which date(s) do you need to adjust?
            </label>
            <div className="space-y-2">
              {dates.map((date, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => updateDate(idx, e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {dates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDate(idx)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
        )}

        {isPermanent && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              This will permanently change your base schedule once approved by
              your manager. Your new {adjustmentType === "time" ? "hours" : adjustmentType === "location" ? "work location" : "hours and work location"} will apply to all future working days.
            </p>
          </div>
        )}

        {/* Time fields */}
        {showTimeFields && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                What time would you like to start?
              </label>
              <input
                type="time"
                required
                value={requestedStart}
                onChange={(e) => setRequestedStart(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                What time would you like to finish?
              </label>
              <input
                type="time"
                required
                value={requestedEnd}
                onChange={(e) => setRequestedEnd(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Location field */}
        {showLocationField && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Where would you like to work?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="work_location"
                  checked={requestedLocation === "office"}
                  onChange={() => setRequestedLocation("office")}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Office</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="work_location"
                  checked={requestedLocation === "online"}
                  onChange={() => setRequestedLocation("online")}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Online</span>
              </label>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Why do you need this adjustment?
          </label>
          <textarea
            required
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please explain the reason for your schedule change..."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
          <Link
            href="/requests"
            className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
