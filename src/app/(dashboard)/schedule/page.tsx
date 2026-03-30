import { getCurrentUser } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { formatTime, formatDate } from "@/lib/utils";
import type { Schedule } from "@/types/database";
import Link from "next/link";

export default async function SchedulePage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  const { data: schedules } = await supabase
    .from("schedules")
    .select("*")
    .eq("employee_id", user.id)
    .lte("effective_from", today)
    .or(`effective_until.is.null,effective_until.gte.${today}`)
    .order("day_of_week", { ascending: true });

  // Get upcoming approved adjustments
  const { data: adjustments } = await supabase
    .from("schedule_adjustments")
    .select("*")
    .eq("employee_id", user.id)
    .eq("status", "approved")
    .gte("requested_date", today)
    .order("requested_date", { ascending: true })
    .limit(20);

  // Get upcoming approved leave
  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("employee_id", user.id)
    .eq("status", "approved")
    .gte("end_date", today)
    .order("start_date", { ascending: true })
    .limit(10);

  const scheduleByDay = new Map<number, Schedule>();
  (schedules ?? []).forEach((s) => {
    scheduleByDay.set(s.day_of_week, s as Schedule);
  });

  const leaveTypeLabels: Record<string, string> = {
    annual: "Annual Leave",
    sick: "Sick Leave",
    personal: "Personal Leave",
    unpaid: "Unpaid Leave",
    other: "Other",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-gray-600">Your current weekly schedule</p>
        </div>
        <Link
          href="/requests"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Make a Request
        </Link>
      </div>

      {/* Base schedule */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Base Schedule
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
          {DAYS_OF_WEEK.map((day, index) => {
            const schedule = scheduleByDay.get(index);
            const isRestDay = schedule?.is_rest_day ?? (index >= 5);

            return (
              <div
                key={day}
                className={`rounded-xl border p-4 ${
                  isRestDay
                    ? "border-gray-200 bg-gray-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <h3 className="text-sm font-semibold text-gray-900">{day}</h3>
                {isRestDay ? (
                  <p className="mt-2 text-sm text-gray-500">Rest Day</p>
                ) : schedule ? (
                  <div className="mt-2 space-y-1">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        schedule.work_location === "office"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {schedule.work_location === "office" ? "Office" : "Online"}
                    </span>
                    <p className="text-sm text-gray-700">
                      {formatTime(schedule.start_time)}
                    </p>
                    <p className="text-xs text-gray-500">to</p>
                    <p className="text-sm text-gray-700">
                      {formatTime(schedule.end_time)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">Not set</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming adjustments */}
      {adjustments && adjustments.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Upcoming Adjustments
          </h2>
          <div className="rounded-xl border border-blue-200 bg-white shadow-sm">
            <div className="divide-y divide-gray-100">
              {adjustments.map((adj) => (
                <div
                  key={adj.id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      {adj.requested_date === "9999-12-31"
                        ? "Permanent Change"
                        : formatDate(adj.requested_date)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatTime(adj.requested_start_time)} -{" "}
                      {formatTime(adj.requested_end_time)}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Adjusted
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming leave */}
      {leaves && leaves.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Upcoming Leave
          </h2>
          <div className="rounded-xl border border-purple-200 bg-white shadow-sm">
            <div className="divide-y divide-gray-100">
              {leaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(leave.start_date)} &mdash;{" "}
                      {formatDate(leave.end_date)}
                    </p>
                    <p className="text-sm text-gray-600">{leave.reason}</p>
                  </div>
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    {leaveTypeLabels[leave.leave_type] ?? leave.leave_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
