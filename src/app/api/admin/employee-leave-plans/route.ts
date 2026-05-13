import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/utils";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { error: "Unauthorized", status: 401 } as const;
  const { data: caller } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();
  if (!caller || !hasRole(caller.role, "hr_admin")) {
    return { error: "Forbidden", status: 403 } as const;
  }
  return { authUser, caller } as const;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await request.json().catch(() => ({}));
  const { employee_id, plan_id } = body;
  if (!employee_id || !plan_id) {
    return NextResponse.json(
      { error: "employee_id and plan_id are required" },
      { status: 400 }
    );
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("employee_leave_plans")
    .insert({ employee_id, plan_id });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const url = new URL(request.url);
  const employee_id = url.searchParams.get("employee_id");
  const plan_id = url.searchParams.get("plan_id");
  if (!employee_id || !plan_id) {
    return NextResponse.json(
      { error: "employee_id and plan_id are required" },
      { status: 400 }
    );
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("employee_leave_plans")
    .delete()
    .eq("employee_id", employee_id)
    .eq("plan_id", plan_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
