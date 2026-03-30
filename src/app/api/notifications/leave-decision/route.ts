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

  const { leave_id, status, notes } = await request.json();

  const admin = createAdminClient();

  // Get leave request details
  const { data: leave } = await admin
    .from("leave_requests")
    .select("*, employee:users!leave_requests_employee_id_fkey(full_name, email)")
    .eq("id", leave_id)
    .single();

  if (!leave) {
    return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
  }

  const leaveLabels: Record<string, string> = {
    annual: "Annual Leave",
    sick: "Sick Leave",
    personal: "Personal Leave",
    unpaid: "Unpaid Leave",
    other: "Other",
  };

  const isApproved = status === "approved";
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Leave Request ${isApproved ? "Approved" : "Rejected"}</h2>
      <div style="background: ${isApproved ? "#f0fdf4" : "#fef2f2"}; border: 1px solid ${isApproved ? "#bbf7d0" : "#fecaca"}; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; font-weight: bold; color: ${isApproved ? "#166534" : "#991b1b"};">
          Your ${leaveLabels[leave.leave_type] ?? leave.leave_type} request has been ${status}.
        </p>
      </div>
      <p><strong>Dates:</strong> ${leave.start_date} to ${leave.end_date}</p>
      ${notes ? `<p><strong>Manager Notes:</strong> ${notes}</p>` : ""}
      <a href="${APP_URL}/requests" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Details</a>
    </div>
  `;

  const result = await sendEmail({
    to: leave.employee.email,
    subject: `Leave Request ${isApproved ? "Approved" : "Rejected"}`,
    html,
  });

  await admin.from("notification_log").insert({
    type: "leave_decision",
    recipient_email: leave.employee.email,
    subject: `Leave Request ${status}`,
    related_id: leave_id,
    status: result.success ? "sent" : "failed",
  });

  return NextResponse.json({ success: result.success });
}
