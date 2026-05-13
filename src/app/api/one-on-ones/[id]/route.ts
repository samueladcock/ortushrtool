import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/utils";

type Patch = {
  scheduled_date?: string;
  agenda?: string | null;
  shared_notes?: string | null;
  manager_private_notes?: string | null;
  employee_private_notes?: string | null;
  participants?: string[];
};

async function loadRow(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin
    .from("one_on_ones")
    .select("id, manager_id, employee_id")
    .eq("id", id)
    .single();
  return data;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const row = await loadRow(admin, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = hasRole(caller.role, "hr_admin");
  const isEmployee = row.employee_id === authUser.id;
  const isManager = row.manager_id === authUser.id;
  // skip-level
  let isSkip = false;
  if (row.manager_id) {
    const { data: mgr } = await admin
      .from("users")
      .select("manager_id")
      .eq("id", row.manager_id)
      .single();
    if (mgr?.manager_id === authUser.id) isSkip = true;
  }
  if (!(isAdmin || isEmployee || isManager || isSkip)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Patch;
  const patch: Record<string, unknown> = {};
  if (body.scheduled_date !== undefined) patch.scheduled_date = body.scheduled_date;
  if (body.agenda !== undefined) patch.agenda = body.agenda;
  if (body.shared_notes !== undefined) patch.shared_notes = body.shared_notes;
  if (Array.isArray(body.participants)) {
    patch.participants = body.participants.filter(
      (p): p is string => typeof p === "string" && p.length > 0
    );
  }
  // Each party can only edit their own private notes.
  if (body.manager_private_notes !== undefined && (isManager || isAdmin)) {
    patch.manager_private_notes = body.manager_private_notes;
  }
  if (body.employee_private_notes !== undefined && (isEmployee || isAdmin)) {
    patch.employee_private_notes = body.employee_private_notes;
  }
  patch.updated_at = new Date().toISOString();

  const { error } = await admin
    .from("one_on_ones")
    .update(patch)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const row = await loadRow(admin, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = hasRole(caller.role, "hr_admin");
  const isManager = row.manager_id === authUser.id;
  if (!isAdmin && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("one_on_ones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
