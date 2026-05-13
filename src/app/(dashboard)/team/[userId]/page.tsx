import { getCurrentUser } from "@/lib/auth/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTime, hasRole } from "@/lib/utils";
import { DAYS_OF_WEEK } from "@/lib/constants";
import {
  HOLIDAY_COUNTRY_LABELS,
  DOCUMENT_TYPE_LABELS,
  type HolidayCountry,
  type DocumentRequest,
  type ProfileField,
  type ProfileFieldSection,
  type ProfileFieldValue,
  type ProfileFieldValueRow,
} from "@/types/database";
import Link from "next/link";
import { ArrowLeft, Mail, Building2, Clock, Globe, Users, MapPin, Cake, BriefcaseBusiness, CalendarX, Flag, FileText } from "lucide-react";
import { CustomFieldsSection } from "@/components/profile/custom-fields";
import { canSeeFieldValue } from "@/lib/profile-fields";
import { format, parseISO, differenceInYears } from "date-fns";
import { UserAvatar } from "@/components/shared/user-avatar";
import { AvatarUpload } from "@/components/shared/avatar-upload";

const ROLE_LABELS: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  hr_admin: "HR Admin",
  super_admin: "Super Admin",
};

const ROLE_COLORS: Record<string, string> = {
  employee: "bg-gray-100 text-gray-700",
  manager: "bg-blue-100 text-blue-700",
  hr_admin: "bg-purple-100 text-purple-700",
  super_admin: "bg-red-100 text-red-700",
};

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const currentUser = await getCurrentUser();
  const { userId } = await params;
  const isOwnProfile = currentUser.id === userId;
  const isAdmin = hasRole(currentUser.role, "hr_admin");
  const isRecruiter = currentUser.role === "hr_support";
  const canSeeEndDate = isAdmin || isOwnProfile;
  // Use admin client to bypass RLS — any employee can view any profile
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  // Flags are visible to: the person themselves, their direct manager, and admins.
  // Recruiters do NOT see flags.
  const canSeeFlags =
    isAdmin || isOwnProfile || user?.manager_id === currentUser.id;

  // Same visibility rules for document requests.
  const canSeeDocuments = canSeeFlags;

  if (!user) {
    return (
      <div className="space-y-4">
        <Link
          href="/team"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} />
          Back to Team
        </Link>
        <p className="text-red-600">User not found.</p>
      </div>
    );
  }

  // Fetch manager name
  let managerName: string | null = null;
  let managerId: string | null = null;
  if (user.manager_id) {
    const { data: manager } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("id", user.manager_id)
      .single();
    managerName = manager?.full_name || manager?.email || null;
    managerId = manager?.id ?? null;
  }

  // Fetch direct reports
  const { data: directReports } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url")
    .eq("manager_id", userId)
    .eq("is_active", true)
    .order("full_name");

  // Fetch current schedule
  const today = new Date().toISOString().split("T")[0];
  const { data: schedules } = await supabase
    .from("schedules")
    .select("*")
    .eq("employee_id", userId)
    .lte("effective_from", today)
    .or(`effective_until.is.null,effective_until.gte.${today}`)
    .order("day_of_week", { ascending: true });

  // Fetch flag history (only if the viewer is allowed to see it)
  const flagHistory = canSeeFlags
    ? (
        await supabase
          .from("attendance_flags")
          .select(
            "id, flag_type, flag_date, deviation_minutes, scheduled_time, actual_time, acknowledged, notes, employee_notes"
          )
          .eq("employee_id", userId)
          .order("flag_date", { ascending: false })
          .limit(50)
      ).data ?? []
    : [];

  // Fetch document request history (same gating as flags)
  const documentHistory = canSeeDocuments
    ? ((
        await supabase
          .from("document_requests")
          .select("*")
          .eq("employee_id", userId)
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? []) as DocumentRequest[]
    : [];

  // Custom profile fields — sections, fields, scalar values, and multi-row
  // values for this employee. RLS enforces per-field visibility.
  const [
    { data: customSections },
    { data: customFields },
    { data: customValues },
    { data: multiRowValues },
  ] = await Promise.all([
    supabase
      .from("profile_field_sections")
      .select("*")
      .order("sort_order")
      .order("name"),
    supabase.from("profile_fields").select("*").order("sort_order"),
    supabase.from("profile_field_values").select("*").eq("employee_id", userId),
    supabase
      .from("profile_field_value_rows")
      .select("*")
      .eq("employee_id", userId)
      .order("row_index"),
  ]);
  const customSectionsList = (customSections ?? []) as ProfileFieldSection[];
  const customFieldsList = (customFields ?? []) as ProfileField[];
  const customValuesList = (customValues ?? []) as ProfileFieldValue[];
  const multiRowValuesList = (multiRowValues ?? []) as ProfileFieldValueRow[];
  // hr_support can also "edit" — their writes get queued for admin approval.
  const canEditCustomFields = isAdmin || isOwnProfile || isRecruiter;
  const customFieldsSubmitMode: "direct" | "queue" =
    isRecruiter && !isOwnProfile ? "queue" : "direct";
  const employeeLabel =
    user?.preferred_name ||
    user?.first_name ||
    user?.full_name ||
    user?.email ||
    userId;

  // Index built-in fields by their key so the Details card can ask each
  // row "what visibility did HR set for this?" and skip rows the viewer
  // isn't allowed to see.
  const builtInByKey = new Map<string, ProfileField>();
  for (const f of customFieldsList) {
    if (f.built_in_key) builtInByKey.set(f.built_in_key, f);
  }
  const isDirectManager = user?.manager_id === currentUser.id;
  const canSeeBuiltIn = (key: string): boolean => {
    const def = builtInByKey.get(key);
    if (!def) return true; // not configured → fall back to current behaviour
    return canSeeFieldValue(def.visibility, {
      isOwnProfile,
      isAdmin,
      isDirectManager,
      isRecruiter,
      visibleToRecruiter: def.visible_to_recruiter,
    });
  };

  const tz =
    user.timezone === "Asia/Manila"
      ? "PHT (Asia/Manila)"
      : user.timezone === "Europe/Berlin"
        ? "CET (Europe/Berlin)"
        : user.timezone === "Asia/Dubai"
          ? "GST (Asia/Dubai)"
          : user.timezone;

  return (
    <div className="space-y-6">
      <Link
        href="/team"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} />
        Back to Team
      </Link>

      {/* Profile Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          {isOwnProfile ? (
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={user.avatar_url}
              userName={user.full_name || user.email}
            />
          ) : (
            <UserAvatar
              name={user.full_name || user.email}
              avatarUrl={user.avatar_url}
              size="lg"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {user.full_name || user.email}
            </h1>
            {user.job_title && (
              <p className="mt-0.5 text-sm text-gray-600">{user.job_title}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"}`}
              >
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {user.department && (
                <span className="flex items-center gap-1">
                  <Building2 size={14} />
                  {user.department}
                </span>
              )}
              {user.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {user.location}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact & Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Details
          </h2>
          <div className="space-y-3">
            {canSeeBuiltIn("email") && (
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="shrink-0 text-gray-400" />
                <span className="text-gray-900">{user.email}</span>
              </div>
            )}
            {canSeeBuiltIn("timezone") && (
              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className="shrink-0 text-gray-400" />
                <span className="text-gray-900">{tz}</span>
              </div>
            )}
            {canSeeBuiltIn("holiday_country") && (
              <div className="flex items-center gap-3 text-sm">
                <Globe size={16} className="shrink-0 text-gray-400" />
                <span className="text-gray-900">
                  {HOLIDAY_COUNTRY_LABELS[user.holiday_country as HolidayCountry] ??
                    user.holiday_country}
                </span>
              </div>
            )}
            {user.birthday && canSeeBuiltIn("birthday") && (
              <div className="flex items-center gap-3 text-sm">
                <Cake size={16} className="shrink-0 text-gray-400" />
                <span className="text-gray-900">
                  {format(parseISO(user.birthday), "MMMM d")}
                </span>
              </div>
            )}
            {user.hire_date && canSeeBuiltIn("hire_date") && (
              <div className="flex items-center gap-3 text-sm">
                <BriefcaseBusiness size={16} className="shrink-0 text-gray-400" />
                <span className="text-gray-900">
                  Joined {format(parseISO(user.hire_date), "MMM d, yyyy")}
                  {(() => {
                    const years = differenceInYears(new Date(), parseISO(user.hire_date));
                    if (years >= 1) return ` (${years} year${years !== 1 ? "s" : ""})`;
                    return "";
                  })()}
                </span>
              </div>
            )}
            {user.end_date && canSeeEndDate && canSeeBuiltIn("end_date") && (
              <div className="flex items-center gap-3 text-sm">
                <CalendarX size={16} className="shrink-0 text-gray-400" />
                <span className="text-gray-900">
                  Last day: {format(parseISO(user.end_date), "MMM d, yyyy")}
                </span>
              </div>
            )}
            {managerName && canSeeBuiltIn("manager_id") && (
              <div className="flex items-center gap-3 text-sm">
                <Users size={16} className="shrink-0 text-gray-400" />
                <span className="text-gray-600">Reports to </span>
                <Link
                  href={`/team/${managerId}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {managerName}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Direct Reports */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Direct Reports
          </h2>
          {directReports && directReports.length > 0 ? (
            <div className="space-y-2">
              {directReports.map((report) => (
                <Link
                  key={report.id}
                  href={`/team/${report.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
                >
                  <UserAvatar
                    name={report.full_name || report.email}
                    avatarUrl={report.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {report.full_name || report.email}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {report.email}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No direct reports</p>
          )}
        </div>
      </div>

      {/* Schedule */}
      {schedules && schedules.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Weekly Schedule
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {schedules.map((s) => (
              <div
                key={s.id}
                className={`rounded-lg border p-3 ${
                  s.is_rest_day
                    ? "border-gray-100 bg-gray-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-sm font-medium text-gray-900">
                  {DAYS_OF_WEEK[s.day_of_week]}
                </p>
                {s.is_rest_day ? (
                  <p className="mt-1 text-xs text-gray-400">Rest Day</p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatTime(s.start_time)} - {formatTime(s.end_time)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                      <MapPin size={12} />
                      {s.work_location === "office" ? "Office" : "Online"}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance Flag History — gated to admin / self / direct manager */}
      {canSeeFlags && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <Flag size={14} />
            Attendance Flag History
          </h2>
          {flagHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No flags on record.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {flagHistory.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          f.flag_type === "late_arrival"
                            ? "bg-yellow-100 text-yellow-700"
                            : f.flag_type === "early_departure"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {f.flag_type === "late_arrival"
                          ? "Late Arrival"
                          : f.flag_type === "early_departure"
                            ? "Early Departure"
                            : "Absent"}
                      </span>
                      <span className="text-sm text-gray-600">
                        {format(parseISO(f.flag_date), "MMM d, yyyy")}
                      </span>
                      {f.deviation_minutes > 0 && (
                        <span className="text-xs text-gray-400">
                          {f.deviation_minutes} min
                        </span>
                      )}
                    </div>
                    {f.employee_notes && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">Employee note:</span>{" "}
                        <span className="italic">{f.employee_notes}</span>
                      </p>
                    )}
                    {f.notes && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">Manager note:</span>{" "}
                        <span className="italic">{f.notes}</span>
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      f.acknowledged
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {f.acknowledged ? "Acknowledged" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document Request History — same gating as flags */}
      {canSeeDocuments && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <FileText size={14} />
            Document Request History
          </h2>
          {documentHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No document requests on record.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {documentHistory.map((d) => {
                const statusStyles: Record<string, string> = {
                  pending: "bg-yellow-100 text-yellow-700",
                  processed: "bg-green-100 text-green-700",
                  cancelled: "bg-gray-100 text-gray-500",
                };
                const docName =
                  d.document_type === "other"
                    ? d.custom_document_name || "Other"
                    : DOCUMENT_TYPE_LABELS[d.document_type];
                return (
                  <div key={d.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{docName}</span>
                        <span className="text-xs text-gray-500">
                          {format(parseISO(d.created_at.slice(0, 10)), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Addressed to <strong>{d.addressee}</strong>
                      </p>
                      {d.document_type === "purpose_of_travel" && d.event_name && (
                        <p className="text-xs text-gray-500">
                          {d.event_name} — {d.event_city}, {d.event_country}
                          {d.event_date && ` (${format(parseISO(d.event_date), "MMM d, yyyy")})`}
                        </p>
                      )}
                      {d.document_type === "leave_certificate" &&
                        d.leave_start_date &&
                        d.leave_end_date && (
                          <p className="text-xs text-gray-500">
                            Leave: {format(parseISO(d.leave_start_date), "MMM d, yyyy")} to{" "}
                            {format(parseISO(d.leave_end_date), "MMM d, yyyy")}
                          </p>
                        )}
                      {d.processor_notes && (
                        <p className="text-xs text-gray-700">
                          <span className="font-medium">HR note:</span>{" "}
                          <span className="italic">{d.processor_notes}</span>
                        </p>
                      )}
                      {d.processor_attachment_url && (
                        <p className="text-xs">
                          <a
                            href={d.processor_attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                          >
                            Open attachment ↗
                          </a>
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[d.status] ?? "bg-gray-100"}`}
                    >
                      {d.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom profile fields. Scalar built-in fields are rendered via the
          Details card above; here we render:
            - Any custom (non-built-in) fields, grouped by their section
            - Multi-row built-in fields (e.g. References) — these don't fit
              the Details card layout
      */}
      {customSectionsList.map((s) => {
        // A field shows up here if it's custom OR if it's a multi-row built-in.
        const fieldsForSection = customFieldsList.filter(
          (f) =>
            f.section_id === s.id &&
            (!f.built_in_key || f.field_type === "multi_row")
        );
        if (fieldsForSection.length === 0) return null;
        const scalarValues = customValuesList.filter((v) =>
          fieldsForSection.some((f) => f.id === v.field_id)
        );
        const rowValues = multiRowValuesList.filter((v) =>
          fieldsForSection.some((f) => f.id === v.field_id)
        );
        // For non-editors, hide a section that has no values they're allowed to see.
        if (
          !canEditCustomFields &&
          scalarValues.length === 0 &&
          rowValues.length === 0
        )
          return null;
        return (
          <CustomFieldsSection
            key={s.id}
            section={s}
            fields={fieldsForSection}
            values={scalarValues}
            multiRowValues={rowValues}
            employeeId={userId}
            employeeLabel={employeeLabel}
            canEdit={canEditCustomFields}
            submitMode={customFieldsSubmitMode}
          />
        );
      })}

    </div>
  );
}
