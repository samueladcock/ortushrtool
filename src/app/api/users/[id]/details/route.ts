import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/utils";

const ALLOWED_FIELDS = new Set([
  "timezone",
  "holiday_country",
  "birthday",
  "hire_date",
  "end_date",
  "company",
  "department",
  "job_title",
  "location",
  "preferred_name",
  "first_name",
  "middle_name",
  "last_name",
  "full_name",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
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

  const isAdmin = hasRole(caller.role, "hr_admin");
  const isSelf = authUser.id === targetId;
  const isHrSupport = caller.role === "hr_support";
  if (!isAdmin && !isSelf && !isHrSupport) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const patch = (body.patch ?? {}) as Record<string, unknown>;
  const cleanPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    cleanPatch[k] = v === "" ? null : v;
  }
  if (Object.keys(cleanPatch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up target email for description/payload
  const { data: target } = await admin
    .from("users")
    .select("email, full_name, preferred_name, first_name, last_name")
    .eq("id", targetId)
    .single();
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const who =
    target.preferred_name ||
    target.first_name ||
    target.full_name ||
    target.email ||
    targetId;

  if (isAdmin) {
    const { error } = await admin
      .from("users")
      .update(cleanPatch)
      .eq("id", targetId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, queued: false });
  }

  // Non-admin: queue as bulk_import with a single row.
  const fieldsTouched = Object.keys(cleanPatch).join(", ");
  const { error } = await admin.from("pending_changes").insert({
    requested_by: authUser.id,
    change_type: "bulk_import",
    target_employee_id: targetId,
    description: `Update profile details (${fieldsTouched}) for ${who}`,
    payload: {
      rows: [
        {
          email: target.email,
          user_id: targetId,
          user_patch: cleanPatch,
        },
      ],
    },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, queued: true });
}
