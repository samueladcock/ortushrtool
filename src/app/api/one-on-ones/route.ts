import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/utils";

type Body = {
  employee_id?: string;
  scheduled_date?: string;
  agenda?: string | null;
  shared_notes?: string | null;
  manager_private_notes?: string | null;
  employee_private_notes?: string | null;
  participants?: string[];
};

async function canCreateOrEdit(
  callerId: string,
  callerRole: string,
  employee: { id: string; manager_id: string | null },
  managerId?: string
): Promise<boolean> {
  if (hasRole(callerRole, "hr_admin")) return true;
  if (callerId === employee.id) return true;
  if (employee.manager_id === callerId) return true;
  if (managerId && managerId === callerId) return true;
  // skip-level
  if (employee.manager_id) {
    // We'd need to look this up — caller is the manager's manager
    return false; // handled in POST/PATCH explicitly below
  }
  return false;
}

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
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const {
    employee_id,
    scheduled_date,
    agenda,
    shared_notes,
    manager_private_notes,
    employee_private_notes,
    participants,
  } = body;
  const participantsList = Array.isArray(participants)
    ? participants.filter(
        (p): p is string => typeof p === "string" && p.length > 0
      )
    : [];
  if (!employee_id || !scheduled_date) {
    return NextResponse.json(
      { error: "employee_id and scheduled_date are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: emp } = await admin
    .from("users")
    .select("id, manager_id")
    .eq("id", employee_id)
    .single();
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Skip-level check
  let isSkip = false;
  if (emp.manager_id) {
    const { data: mgr } = await admin
      .from("users")
      .select("manager_id")
      .eq("id", emp.manager_id)
      .single();
    if (mgr?.manager_id === authUser.id) isSkip = true;
  }
  const ok =
    (await canCreateOrEdit(authUser.id, caller.role, emp)) || isSkip;
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pick a "manager of record" — keep it semantically primary. If the
  // employee has a direct manager and they're in the participants list (or
  // the lone non-subject attendee), prefer them; otherwise use the creator.
  const candidatesForManager = [
    ...participantsList,
    authUser.id,
  ].filter((id) => id !== employee_id);
  const managerOfRecord =
    emp.manager_id && candidatesForManager.includes(emp.manager_id)
      ? emp.manager_id
      : candidatesForManager[0] ?? authUser.id;

  // Other participants stored in the JSONB array (excluding the subject and
  // the manager-of-record, deduped).
  const otherParticipants = Array.from(
    new Set(
      participantsList.filter(
        (p) => p !== employee_id && p !== managerOfRecord
      )
    )
  );

  const { data, error } = await admin
    .from("one_on_ones")
    .insert({
      manager_id: managerOfRecord,
      employee_id,
      scheduled_date,
      agenda: agenda ?? null,
      shared_notes: shared_notes ?? null,
      manager_private_notes:
        authUser.id === managerOfRecord ? manager_private_notes ?? null : null,
      employee_private_notes:
        authUser.id === employee_id ? employee_private_notes ?? null : null,
      participants: otherParticipants,
      created_by: authUser.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, one_on_one: data });
}
