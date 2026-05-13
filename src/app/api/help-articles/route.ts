import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/utils";
import {
  applyHelpArticleChange,
  type HelpArticleChangePayload,
} from "@/lib/pending-changes";

/**
 * Single endpoint for all help-article edits.
 * - hr_admin / super_admin: applies immediately
 * - hr_support: writes into pending_changes for admin review
 * - everyone else: 403
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
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = hasRole(caller.role, "hr_admin");
  const isHrSupport = caller.role === "hr_support";
  if (!isAdmin && !isHrSupport) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as HelpArticleChangePayload;
  if (!body || typeof body !== "object" || !("op" in body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (isAdmin) {
    const result = await applyHelpArticleChange(admin, authUser.id, body);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Apply failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, queued: false });
  }

  // hr_support → queue for admin review
  const description = describeOp(body);
  const { error } = await admin.from("pending_changes").insert({
    requested_by: authUser.id,
    change_type: "help_article_change",
    target_employee_id: null,
    description,
    payload: body,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, queued: true });
}

function describeOp(p: HelpArticleChangePayload): string {
  switch (p.op) {
    case "insert": {
      const section = (p.row.section_title as string) ?? "(new)";
      return `Add Help article in "${section}"`;
    }
    case "update":
      return `Update Help article ${p.id}`;
    case "delete":
      return `Delete Help article ${p.id}`;
    case "bulk_update": {
      const section = p.filter.section_title as string | undefined;
      const patchKeys = Object.keys(p.patch).join(", ");
      return section
        ? `Update Help section "${section}" (${patchKeys})`
        : `Bulk update Help articles (${patchKeys})`;
    }
    case "bulk_delete": {
      const section = p.filter.section_title as string | undefined;
      return section
        ? `Delete Help section "${section}"`
        : `Bulk delete Help articles`;
    }
  }
}
