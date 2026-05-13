import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/utils";
import type { ReviewResponses, ReviewStatus } from "@/types/database";

type Body = {
  kind: "self" | "manager";
  responses: ReviewResponses;
  submit?: boolean;
};

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
  const { data: review } = await admin
    .from("reviews")
    .select("id, employee_id, status, self_responses, manager_responses")
    .eq("id", id)
    .single();
  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (review.status === "signed_off") {
    return NextResponse.json(
      { error: "Review is signed off and locked" },
      { status: 409 }
    );
  }

  const isAdmin = hasRole(caller.role, "hr_admin");
  const isSelf = review.employee_id === authUser.id;

  // Check if caller is direct manager or skip-level
  const { data: emp } = await admin
    .from("users")
    .select("manager_id")
    .eq("id", review.employee_id)
    .single();
  const isDirectManager = emp?.manager_id === authUser.id;
  let isSkipLevel = false;
  if (emp?.manager_id) {
    const { data: mgr } = await admin
      .from("users")
      .select("manager_id")
      .eq("id", emp.manager_id)
      .single();
    if (mgr?.manager_id === authUser.id) isSkipLevel = true;
  }
  const isManagerSide = isAdmin || isDirectManager || isSkipLevel;

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.kind || !body.responses) {
    return NextResponse.json(
      { error: "kind and responses are required" },
      { status: 400 }
    );
  }

  if (body.kind === "self" && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (body.kind === "manager" && !isManagerSide) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.kind === "self") {
    patch.self_responses = body.responses;
    if (body.submit) {
      patch.self_submitted_at = new Date().toISOString();
      const next: ReviewStatus =
        review.status === "manager_done" ? "signed_off" : "self_done";
      patch.status = next;
      if (next === "signed_off") patch.signed_off_at = new Date().toISOString();
    }
  } else {
    patch.manager_responses = body.responses;
    if (body.submit) {
      patch.manager_submitted_at = new Date().toISOString();
      patch.manager_reviewer_id = authUser.id;
      const next: ReviewStatus =
        review.status === "self_done" ? "signed_off" : "manager_done";
      patch.status = next;
      if (next === "signed_off") patch.signed_off_at = new Date().toISOString();
    }
  }

  const { error } = await admin.from("reviews").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
