import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReviewResponses } from "@/types/database";

type Body = {
  response?: ReviewResponses;
  status?: "completed" | "declined";
  anonymous?: boolean;
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
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("peer_feedback_requests")
    .select("id, reviewer_id, status")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.reviewer_id !== authUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (row.status === "completed") {
    return NextResponse.json(
      { error: "Already completed" },
      { status: 409 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const patch: Record<string, unknown> = {};
  if (body.response !== undefined) patch.response = body.response;
  if (body.anonymous !== undefined) patch.anonymous = body.anonymous;
  if (body.status) {
    patch.status = body.status;
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("peer_feedback_requests")
    .update(patch)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
