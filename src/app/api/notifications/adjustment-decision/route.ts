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

  const { adjustment_id, status, notes } = await request.json();

  const admin = createAdminClient();

  // Get adjustment details with employee info
  const { data: adjustment } = await admin
    .from("schedule_adjustments")
    .select("*, employee:users!schedule_adjustments_employee_id_fkey(full_name, email, manager_id)")
    .eq("id", adjustment_id)
    .single();

  if (!adjustment) {
    return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
  }

  const employee = adjustment.employee;
  const recipients: string[] = [employee.email];

  // Get manager email
  if (employee.manager_id) {
    const { data: manager } = await admin
      .from("users")
      .select("email")
      .eq("id", employee.manager_id)
      .single();
    if (manager) recipients.push(manager.email);
  }

  // Also include the reviewer if different from manager
  const { data: reviewer } = await admin
    .from("users")
    .select("email")
    .eq("id", authUser.id)
    .single();
  if (reviewer && !recipients.includes(reviewer.email)) {
    recipients.push(reviewer.email);
  }

  const requestedDate =
    adjustment.requested_date === "9999-12-31"
      ? "Permanent Change"
      : adjustment.requested_date;

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const templateType = status === "approved" ? "adjustment_approved" : "adjustment_rejected";
  const { subject, html } = await loadAndRender(templateType, {
    employee_name: employee.full_name || employee.email,
    requested_date: requestedDate,
    requested_time: `${adjustment.requested_start_time.slice(0, 5)} - ${adjustment.requested_end_time.slice(0, 5)}`,
    notes: notes || "",
    app_url: APP_URL,
  });

  const result = await sendEmail({
    to: recipients,
    subject,
    html,
  });

  // Log notifications
  for (const email of recipients) {
    await admin.from("notification_log").insert({
      type: "schedule_adjustment_decision",
      recipient_email: email,
      subject: `Schedule Adjustment ${status}`,
      related_id: adjustment_id,
      status: result.success ? "sent" : "failed",
    });
  }

  return NextResponse.json({ success: result.success });
}
