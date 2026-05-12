import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/utils";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", authUser.id)
    .single();

  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const flagIds: unknown = body.flag_ids;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!Array.isArray(flagIds) || flagIds.length === 0) {
    return NextResponse.json(
      { error: "flag_ids must be a non-empty array" },
      { status: 400 }
    );
  }

  const cleanIds = flagIds.filter(
    (id): id is string => typeof id === "string"
  );

  const admin = createAdminClient();
  const isAdmin = hasRole(caller.role, "hr_admin");

  const { data: flags } = await admin
    .from("attendance_flags")
    .select(
      "id, employee_id, acknowledged, employee:users!attendance_flags_employee_id_fkey(manager_id)"
    )
    .in("id", cleanIds);

  const acknowledgedIds: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of cleanIds) {
    const flag = (flags ?? []).find((f) => f.id === id);
    if (!flag) {
      skipped.push({ id, reason: "Flag not found" });
      continue;
    }
    if (flag.acknowledged) {
      skipped.push({ id, reason: "Already acknowledged" });
      continue;
    }
    if (flag.employee_id === caller.id) {
      skipped.push({ id, reason: "Cannot acknowledge own flag" });
      continue;
    }
    const employee = Array.isArray(flag.employee)
      ? flag.employee[0]
      : flag.employee;
    const isDirectManager = employee?.manager_id === caller.id;
    if (!isAdmin && !isDirectManager) {
      skipped.push({ id, reason: "Not authorized" });
      continue;
    }
    acknowledgedIds.push(id);
  }

  if (acknowledgedIds.length > 0) {
    const { error } = await admin
      .from("attendance_flags")
      .update({ acknowledged: true, notes: notes || null })
      .in("id", acknowledgedIds);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    acknowledged: acknowledgedIds.length,
    skipped,
  });
}
