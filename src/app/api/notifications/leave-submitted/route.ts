import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { loadAndRender } from "@/lib/email/render";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leave_type, start_date, end_date, reason } = await request.json();

  const admin = createAdminClient();

  const { data: employee } = await admin
    .from("users")
    .select("full_name, email, manager_id")
    .eq("id", authUser.id)
    .single();

  if (!employee?.manager_id) {
    return NextResponse.json({ error: "No manager assigned" }, { status: 400 });
  }

  const { data: manager } = await admin
    .from("users")
    .select("email, full_name")
    .eq("id", employee.manager_id)
    .single();

  if (!manager) {
    return NextResponse.json({ error: "Manager not found" }, { status: 400 });
  }

  const leaveLabels: Record<string, string> = {
    annual: "Annual Leave",
    sick: "Sick Leave",
    personal: "Personal Leave",
    unpaid: "Unpaid Leave",
    other: "Other",
  };

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { subject, html } = await loadAndRender("leave_submitted", {
    employee_name: employee.full_name || employee.email,
    leave_type: leaveLabels[leave_type] ?? leave_type,
    start_date,
    end_date,
    reason,
    app_url: APP_URL,
  });

  const result = await sendEmail({
    to: manager.email,
    subject,
    html,
  });

  await admin.from("notification_log").insert({
    type: "leave_request",
    recipient_email: manager.email,
    subject: `Leave Request from ${employee.full_name}`,
    status: result.success ? "sent" : "failed",
  });

  return NextResponse.json({ success: result.success });
}
