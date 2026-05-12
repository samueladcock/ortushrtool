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

  const { overtime_id, status, notes } = await request.json();

  const admin = createAdminClient();

  const { data: ot } = await admin
    .from("overtime_requests")
    .select(
      "*, employee:users!overtime_requests_employee_id_fkey(full_name, email, preferred_name, first_name, last_name, department, job_title, location, manager_id)"
    )
    .eq("id", overtime_id)
    .single();

  if (!ot) {
    return NextResponse.json({ error: "Overtime request not found" }, { status: 404 });
  }

  const employee = ot.employee;
  const recipients: string[] = [employee.email];

  let manager: { email: string; full_name: string | null } | null = null;
  if (employee.manager_id) {
    const { data: m } = await admin
      .from("users")
      .select("email, full_name")
      .eq("id", employee.manager_id)
      .single();
    if (m) {
      manager = m;
      recipients.push(m.email);
    }
  }

  const { data: reviewer } = await admin
    .from("users")
    .select("email")
    .eq("id", authUser.id)
    .single();
  if (reviewer && !recipients.includes(reviewer.email)) {
    recipients.push(reviewer.email);
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const templateType = status === "approved" ? "overtime_approved" : "overtime_rejected";
  const { subject, html } = await loadAndRender(templateType, {
    ...getUniversalVars(employee, manager, APP_URL),
    employee_name: employee.full_name || employee.email,
    requested_date: ot.requested_date,
    start_time: ot.start_time,
    end_time: ot.end_time,
    notes: notes || "",
  });

  const result = await sendEmail({
    to: [...new Set(recipients)],
    subject,
    html,
  });

  for (const email of recipients) {
    await admin.from("notification_log").insert({
      type: "overtime_decision",
      recipient_email: email,
      subject: `Overtime Request ${status}`,
      related_id: overtime_id,
      status: result.success ? "sent" : "failed",
    });
  }

  return NextResponse.json({ success: result.success });
}
