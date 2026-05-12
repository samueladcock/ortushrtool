import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { loadAndRender } from "@/lib/email/render";
import { getUniversalVars } from "@/lib/email/universal-vars";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requested_date, start_time, end_time, reason } =
    await request.json();

  const admin = createAdminClient();

  const { data: employee } = await admin
    .from("users")
    .select(
      "full_name, email, preferred_name, first_name, last_name, department, job_title, location, manager_id"
    )
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

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { subject, html } = await loadAndRender("overtime_submitted", {
    ...getUniversalVars(employee, manager, APP_URL),
    employee_name: employee.full_name || employee.email,
    requested_date,
    start_time,
    end_time,
    reason,
  });

  const result = await sendEmail({
    to: manager.email,
    subject,
    html,
  });

  await admin.from("notification_log").insert({
    type: "overtime_request",
    recipient_email: manager.email,
    subject: `Overtime Request from ${employee.full_name}`,
    status: result.success ? "sent" : "failed",
  });

  return NextResponse.json({ success: result.success });
}
