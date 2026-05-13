import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { recipient_id, message, visibility } = body;
  if (!recipient_id || !message || typeof message !== "string") {
    return NextResponse.json(
      { error: "recipient_id and message are required" },
      { status: 400 }
    );
  }
  if (recipient_id === authUser.id) {
    return NextResponse.json(
      { error: "Can't send kudos to yourself" },
      { status: 400 }
    );
  }
  const vis = visibility === "private" ? "private" : "public";

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("kudos")
    .insert({
      recipient_id,
      sender_id: authUser.id,
      message: message.trim(),
      visibility: vis,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, kudos: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const { data: caller } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("kudos")
    .select("sender_id")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin =
    caller?.role === "hr_admin" || caller?.role === "super_admin";
  if (row.sender_id !== authUser.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await admin.from("kudos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
