import { requireRole } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { ReportsTabs } from "@/components/reports/reports-tabs";

export default async function ReportsPage() {
  await requireRole("hr_admin");
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, department")
    .eq("is_active", true)
    .order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600">
          Attendance and leave reporting
        </p>
      </div>
      <ReportsTabs users={users ?? []} />
    </div>
  );
}
