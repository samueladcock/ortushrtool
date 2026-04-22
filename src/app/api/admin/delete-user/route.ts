import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  if (!currentUser || !["hr_admin", "super_admin"].includes(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Prevent self-deletion
  if (userId === authUser.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Clear all foreign key references that don't cascade
  await Promise.all([
    // Null out manager_id references from other users
    admin.from("users").update({ manager_id: null }).eq("manager_id", userId),
    // Null out created_by on holidays
    admin.from("holidays").update({ created_by: null }).eq("created_by", userId),
    // Null out reviewed_by on leave requests
    admin.from("leave_requests").update({ reviewed_by: null }).eq("reviewed_by", userId),
    // Null out reviewed_by on schedule adjustments
    admin.from("schedule_adjustments").update({ reviewed_by: null }).eq("reviewed_by", userId),
    // Null out reviewed_by on holiday work requests
    admin.from("holiday_work_requests").update({ reviewed_by: null }).eq("reviewed_by", userId),
    // Null out updated_by on system settings
    admin.from("system_settings").update({ updated_by: null }).eq("updated_by", userId),
    // Null out updated_by on email templates
    admin.from("email_templates").update({ updated_by: null }).eq("updated_by", userId),
    // Null out created_by / assigned_by / updated_by on KPI tables
    admin.from("kpi_definitions").update({ created_by: null }).eq("created_by", userId),
    admin.from("kpi_assignments").update({ assigned_by: null }).eq("assigned_by", userId),
    admin.from("kpi_scores").update({ updated_by: null }).eq("updated_by", userId),
    // Null out notification log references
    admin.from("notification_log").update({ related_id: null }).eq("related_id", userId),
  ]);

  // Delete from public.users (cascades to schedules, attendance, flags, etc.)
  const { error: deleteError } = await admin
    .from("users")
    .delete()
    .eq("id", userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Delete from auth.users
  const { error: authError } = await admin.auth.admin.deleteUser(userId);

  if (authError) {
    return NextResponse.json(
      { error: `User data deleted but auth removal failed: ${authError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
