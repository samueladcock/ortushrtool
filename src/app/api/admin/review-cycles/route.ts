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
  const {
    name,
    template_id,
    start_date,
    end_date,
    self_due,
    manager_due,
    peer_due,
    participant_ids,
  } = body;
  if (!name || !template_id || !start_date || !end_date) {
    return NextResponse.json(
      { error: "name, template_id, start_date, end_date are required" },
      { status: 400 }
    );
  }
  const admin = createAdminClient();
  const { data: cycle, error } = await admin
    .from("review_cycles")
    .insert({
      name,
      template_id,
      start_date,
      end_date,
      self_due: self_due ?? null,
      manager_due: manager_due ?? null,
      peer_due: peer_due ?? null,
      status: "draft",
      created_by: auth.authUser.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(participant_ids) && participant_ids.length > 0) {
    const rows = participant_ids.map((employee_id: string) => ({
      cycle_id: cycle.id,
      employee_id,
    }));
    await admin.from("review_cycle_participants").insert(rows);
    // Pre-create the review rows so participants can navigate to them.
    const reviewRows = participant_ids.map((employee_id: string) => ({
      cycle_id: cycle.id,
      employee_id,
    }));
    await admin.from("reviews").insert(reviewRows);
  }

  return NextResponse.json({ ok: true, cycle });
}
