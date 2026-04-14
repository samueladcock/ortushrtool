import { requireRole } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { LeavePlansManager } from "@/components/admin/leave-plans-manager";
import { BulkPlanAssign } from "@/components/admin/bulk-plan-assign";

export default async function LeavePlansPage() {
  await requireRole("hr_admin");
  const supabase = await createClient();

  const [{ data: plans }, { data: allocations }, { data: users }] = await Promise.all([
    supabase.from("leave_plans").select("*").order("name"),
    supabase.from("leave_plan_allocations").select("*"),
    supabase.from("users").select("id, full_name, email, department").eq("is_active", true).order("full_name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leave Plans</h1>
        <p className="text-gray-600">
          Create and manage leave plans with allocations per leave type
        </p>
      </div>
      <LeavePlansManager
        initialPlans={plans ?? []}
        initialAllocations={allocations ?? []}
      />
      {(plans ?? []).length > 0 && (
        <BulkPlanAssign
          plans={plans ?? []}
          users={users ?? []}
        />
      )}
    </div>
  );
}
