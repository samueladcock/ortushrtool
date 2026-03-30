import { getCurrentUser } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { hasRole, formatDate, formatTime } from "@/lib/utils";
import { AdjustmentActions } from "@/components/adjustments/adjustment-actions";
import { LeaveActions } from "@/components/leave/leave-actions";
import Link from "next/link";
import { ArrowRightLeft, CalendarOff } from "lucide-react";

export default async function RequestsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const isReviewer = hasRole(user.role, "manager");

  // Fetch schedule adjustments
  let adjQuery = supabase
    .from("schedule_adjustments")
    .select("*, employee:users!schedule_adjustments_employee_id_fkey(full_name, email)")
    .order("created_at", { ascending: false });

  if (!isReviewer) {
    adjQuery = adjQuery.eq("employee_id", user.id);
  }

  const { data: adjustments } = await adjQuery;

  // Fetch leave requests
  let leaveQuery = supabase
    .from("leave_requests")
    .select("*, employee:users!leave_requests_employee_id_fkey(full_name, email)")
    .order("created_at", { ascending: false });

  if (!isReviewer) {
    leaveQuery = leaveQuery.eq("employee_id", user.id);
  }

  const { data: leaveRequests } = await leaveQuery;

  const pendingAdj = (adjustments ?? []).filter((a) => a.status === "pending");
  const pastAdj = (adjustments ?? []).filter((a) => a.status !== "pending");
  const pendingLeave = (leaveRequests ?? []).filter((l) => l.status === "pending");
  const pastLeave = (leaveRequests ?? []).filter((l) => l.status !== "pending");

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
          <h1 className="text-2xl font-bold text-gray-900">
            {isReviewer ? "Team Requests" : "My Requests"}
          </h1>
          <p className="text-gray-600">
            {isReviewer
              ? "Review schedule adjustment and leave requests"
              : "Track your schedule and leave requests"}
          </p>
        </div>
        {!isReviewer && (
          <div className="flex gap-3">
            <Link
              href="/requests/schedule-adjustment"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <ArrowRightLeft size={16} />
              Schedule Adjustment
            </Link>
            <Link
              href="/requests/leave"
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              <CalendarOff size={16} />
              Request Leave
            </Link>
          </div>
        )}
      </div>

      {/* Action buttons for reviewers too */}
      {isReviewer && (
        <div className="flex gap-3">
          <Link
            href="/requests/schedule-adjustment"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowRightLeft size={16} />
            Schedule Adjustment
          </Link>
          <Link
            href="/requests/leave"
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <CalendarOff size={16} />
            Request Leave
          </Link>
        </div>
      )}

      {/* Pending Schedule Adjustments */}
      {pendingAdj.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Schedule Adjustments ({pendingAdj.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingAdj.map((adj) => (
              <div key={adj.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {isReviewer && adj.employee && (
                      <p className="font-medium text-gray-900">
                        {adj.employee.full_name || adj.employee.email}
                      </p>
                    )}
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Date:</span>{" "}
                      {formatDate(adj.requested_date)}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Original:</span>{" "}
                      {formatTime(adj.original_start_time)} -{" "}
                      {formatTime(adj.original_end_time)}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Requested:</span>{" "}
                      {formatTime(adj.requested_start_time)} -{" "}
                      {formatTime(adj.requested_end_time)}
                    </p>
                    <p className="text-sm text-gray-600">{adj.reason}</p>
                  </div>
                  {isReviewer && <AdjustmentActions adjustmentId={adj.id} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Leave Requests */}
      {pendingLeave.length > 0 && (
        <div className="rounded-xl border border-purple-200 bg-white shadow-sm">
          <div className="border-b border-purple-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Leave Requests ({pendingLeave.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingLeave.map((leave) => (
              <div key={leave.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {isReviewer && leave.employee && (
                      <p className="font-medium text-gray-900">
                        {leave.employee.full_name || leave.employee.email}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {leaveTypeLabels[leave.leave_type] ?? leave.leave_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">From:</span>{" "}
                      {formatDate(leave.start_date)} &mdash;{" "}
                      <span className="font-medium">To:</span>{" "}
                      {formatDate(leave.end_date)}
                    </p>
                    <p className="text-sm text-gray-600">{leave.reason}</p>
                  </div>
                  {isReviewer && <LeaveActions leaveId={leave.id} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
        </div>
        {pastAdj.length === 0 && pastLeave.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No past requests.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pastAdj.map((adj) => (
              <div key={adj.id} className="flex items-center justify-between p-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Schedule Adjustment
                    </span>
                    {isReviewer && adj.employee && (
                      <span className="text-sm font-medium text-gray-900">
                        {adj.employee.full_name || adj.employee.email}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">
                    {formatDate(adj.requested_date)} &mdash;{" "}
                    {formatTime(adj.requested_start_time)} -{" "}
                    {formatTime(adj.requested_end_time)}
                  </p>
                  {adj.reviewer_notes && (
                    <p className="text-sm text-gray-500 italic">
                      Note: {adj.reviewer_notes}
                    </p>
                  )}
                </div>
                <StatusBadge status={adj.status} />
              </div>
            ))}
            {pastLeave.map((leave) => (
              <div key={leave.id} className="flex items-center justify-between p-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {leaveTypeLabels[leave.leave_type] ?? leave.leave_type}
                    </span>
                    {isReviewer && leave.employee && (
                      <span className="text-sm font-medium text-gray-900">
                        {leave.employee.full_name || leave.employee.email}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">
                    {formatDate(leave.start_date)} &mdash;{" "}
                    {formatDate(leave.end_date)}
                  </p>
                  {leave.reviewer_notes && (
                    <p className="text-sm text-gray-500 italic">
                      Note: {leave.reviewer_notes}
                    </p>
                  )}
                </div>
                <StatusBadge status={leave.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${styles[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  );
}
