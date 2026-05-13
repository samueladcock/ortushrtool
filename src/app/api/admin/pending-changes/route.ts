import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Create a pending change. Used by HR support flows whose writes need admin
 * approval. Admins skip this path and write directly.
 */
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
    .select("role")
    .eq("id", authUser.id)
    .single();
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { change_type, target_employee_id, description, payload } = body;
  if (!change_type || !description || !payload) {
    return NextResponse.json(
      { error: "change_type, description, and payload are required" },
      { status: 400 }
    );
  }

  // hr_support / hr_admin / super_admin can queue changes against any
  // employee. Everyone else (employee, manager) can only queue changes
  // against their own profile.
  const hrRoles = new Set(["hr_support", "hr_admin", "super_admin"]);
  if (!hrRoles.has(caller.role) && target_employee_id !== authUser.id) {
    return NextResponse.json(
      { error: "Can only request changes to your own profile" },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pending_changes")
    .insert({
      requested_by: authUser.id,
      change_type,
      target_employee_id: target_employee_id ?? null,
      description,
      payload,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ pending_change: data });
}
