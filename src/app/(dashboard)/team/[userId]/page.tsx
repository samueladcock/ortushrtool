import { getCurrentUser } from "@/lib/auth/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/utils";
import {
  type ProfileField,
  type ProfileFieldSection,
  type ProfileFieldValue,
  type ProfileFieldValueRow,
} from "@/types/database";
import Link from "next/link";
import { CustomFieldsSection } from "@/components/profile/custom-fields";
import { DetailsEditor } from "@/components/profile/details-editor";
import { canSeeFieldValue } from "@/lib/profile-fields";
import { UserAvatar } from "@/components/shared/user-avatar";

export default async function TeamMemberProfileTab({
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
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (!user) return null; // layout already shows the "not found" state

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

  const { data: directReports } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url")
    .eq("manager_id", userId)
    .eq("is_active", true)
    .order("full_name");

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

  const canEditCustomFields = isAdmin || isOwnProfile || isRecruiter;
  const customFieldsSubmitMode: "direct" | "queue" = isAdmin
    ? "direct"
    : "queue";
  const employeeLabel =
    user?.preferred_name ||
    user?.first_name ||
    user?.full_name ||
    user?.email ||
    userId;

  const builtInByKey = new Map<string, ProfileField>();
  for (const f of customFieldsList) {
    if (f.built_in_key) builtInByKey.set(f.built_in_key, f);
  }
  const isDirectManager = user?.manager_id === currentUser.id;
  const canSeeBuiltIn = (key: string): boolean => {
    const def = builtInByKey.get(key);
    if (!def) return true;
    return canSeeFieldValue(def.visibility, {
      isOwnProfile,
      isAdmin,
      isDirectManager,
      isRecruiter,
      visibleToRecruiter: def.visible_to_recruiter,
    });
  };
  // Precompute visibility for the built-in keys the Details card cares about
  // so we can pass a plain object to the client component.
  const detailsVisibility: Record<string, boolean> = {};
  for (const key of [
    "email",
    "timezone",
    "holiday_country",
    "birthday",
    "hire_date",
    "end_date",
    "manager_id",
  ]) {
    detailsVisibility[key] = canSeeBuiltIn(key);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <DetailsEditor
          user={{
            id: user.id,
            email: user.email,
            timezone: user.timezone,
            holiday_country: user.holiday_country,
            birthday: user.birthday,
            hire_date: user.hire_date,
            end_date: user.end_date,
          }}
          managerName={managerName}
          managerId={managerId}
          canEdit={isAdmin || isOwnProfile}
          submitMode={isAdmin ? "direct" : "queue"}
          visibility={detailsVisibility}
          canSeeEndDate={canSeeEndDate}
        />

        {/* Direct Reports */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-gray-500">
            <span>Direct Reports</span>
            {directReports && directReports.length > 0 && (
              <span className="text-xs font-normal text-gray-400">
                {directReports.length}
              </span>
            )}
          </h2>
          {directReports && directReports.length > 0 ? (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
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

      {customSectionsList.map((s) => {
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
