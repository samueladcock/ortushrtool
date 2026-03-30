import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";

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

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Leave Request</h2>
      <p>${employee.full_name || employee.email} has submitted a leave request.</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Type</td><td style="padding: 8px 0; font-weight: bold;">${leaveLabels[leave_type] ?? leave_type}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">From</td><td style="padding: 8px 0;">${start_date}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">To</td><td style="padding: 8px 0;">${end_date}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Reason</td><td style="padding: 8px 0;">${reason}</td></tr>
      </table>
      <a href="${APP_URL}/requests" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px;">Review Request</a>
    </div>
  `;

  const result = await sendEmail({
    to: manager.email,
    subject: `Leave Request from ${employee.full_name || employee.email}`,
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
