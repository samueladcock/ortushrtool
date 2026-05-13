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

  const allowedRoles = new Set(["hr_support", "hr_admin", "super_admin"]);
  if (!allowedRoles.has(caller.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { change_type, target_employee_id, description, payload } = body;
  if (!change_type || !description || !payload) {
    return NextResponse.json(
      { error: "change_type, description, and payload are required" },
      { status: 400 }
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
