import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/utils";
import {
  applyBulkImport,
  applyFieldValueUpsert,
  applyFieldValueDelete,
  applyMultiRowInsert,
  applyMultiRowUpdate,
  applyMultiRowDelete,
  applyScheduleWeeklyChange,
  applyHelpArticleChange,
  type BulkImportPayload,
  type FieldValueUpsertPayload,
  type FieldValueDeletePayload,
  type MultiRowInsertPayload,
  type MultiRowUpdatePayload,
  type MultiRowDeletePayload,
  type ScheduleWeeklyChangePayload,
  type HelpArticleChangePayload,
} from "@/lib/pending-changes";

type Decision = "approve" | "reject";

export async function POST(
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
  if (!caller || !hasRole(caller.role, "hr_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const decision = body.decision as Decision;
  const decision_notes =
    typeof body.decision_notes === "string" ? body.decision_notes : null;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: change } = await admin
    .from("pending_changes")
    .select("*")
    .eq("id", id)
    .single();
  if (!change) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (change.status !== "pending") {
    return NextResponse.json(
      { error: `Already ${change.status}` },
      { status: 409 }
    );
  }

  let applied_at: string | null = null;
  let applyDetail: Record<string, unknown> | null = null;
  if (decision === "approve") {
    let result;
    switch (change.change_type) {
      case "bulk_import":
        result = await applyBulkImport(
          admin,
          authUser.id,
          change.payload as BulkImportPayload
        );
        break;
      case "field_value_upsert":
        result = await applyFieldValueUpsert(
          admin,
          authUser.id,
          change.payload as FieldValueUpsertPayload
        );
        break;
      case "field_value_delete":
        result = await applyFieldValueDelete(
          admin,
          authUser.id,
          change.payload as FieldValueDeletePayload
        );
        break;
      case "multi_row_insert":
        result = await applyMultiRowInsert(
          admin,
          authUser.id,
          change.payload as MultiRowInsertPayload
        );
        break;
      case "multi_row_update":
        result = await applyMultiRowUpdate(
          admin,
          authUser.id,
          change.payload as MultiRowUpdatePayload
        );
        break;
      case "multi_row_delete":
        result = await applyMultiRowDelete(
          admin,
          authUser.id,
          change.payload as MultiRowDeletePayload
        );
        break;
      case "schedule_weekly_change":
        result = await applyScheduleWeeklyChange(
          admin,
          authUser.id,
          change.payload as ScheduleWeeklyChangePayload
        );
        break;
      case "help_article_change":
        result = await applyHelpArticleChange(
          admin,
          authUser.id,
          change.payload as HelpArticleChangePayload
        );
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported change_type: ${change.change_type}` },
          { status: 400 }
        );
    }
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Apply failed", details: result.errors },
        { status: 500 }
      );
    }
    applied_at = new Date().toISOString();
    applyDetail = {
      rowsUpdated: result.rowsUpdated,
      cellsWritten: result.cellsWritten,
    };
  }

  const { error } = await admin
    .from("pending_changes")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      decided_by: authUser.id,
      decided_at: new Date().toISOString(),
      decision_notes,
      applied_at,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, applied: applyDetail });
}
