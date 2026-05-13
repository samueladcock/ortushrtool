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
  const { name, description, questions } = body;
  if (!name || !Array.isArray(questions)) {
    return NextResponse.json(
      { error: "name and questions are required" },
      { status: 400 }
    );
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("review_form_templates")
    .insert({
      name,
      description: description ?? null,
      questions,
      created_by: auth.authUser.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}
