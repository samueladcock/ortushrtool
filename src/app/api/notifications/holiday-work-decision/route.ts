import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { loadAndRender } from "@/lib/email/render";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { request_id, status, notes } = await request.json();

  const admin = createAdminClient();

  const { data: hwRequest } = await admin
    .from("holiday_work_requests")
    .select("*, employee:users!holiday_work_requests_employee_id_fkey(full_name, email, manager_id), holiday:holidays!holiday_work_requests_holiday_id_fkey(name)")
    .eq("id", request_id)
    .single();

  if (!hwRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const isApproved = status === "approved";
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const employeeName = hwRequest.employee.full_name || hwRequest.employee.email;
  const locationLabel = hwRequest.work_location === "online" ? "Online" : "Office";

  const templateType = isApproved ? "holiday_work_approved" : "holiday_work_rejected";
  const { subject, html } = await loadAndRender(templateType, {
    employee_name: employeeName,
    holiday_name: hwRequest.holiday.name,
    holiday_date: hwRequest.holiday_date,
    start_time: hwRequest.start_time,
    end_time: hwRequest.end_time,
    location: locationLabel,
    notes: notes || "",
    app_url: APP_URL,
  });

  const recipients: string[] = [hwRequest.employee.email];

  if (hwRequest.employee.manager_id) {
    const { data: manager } = await admin
      .from("users")
      .select("email")
      .eq("id", hwRequest.employee.manager_id)
      .single();
    if (manager) recipients.push(manager.email);
  }

  const { data: reviewer } = await admin
    .from("users")
    .select("email")
    .eq("id", authUser.id)
    .single();
  if (reviewer && !recipients.includes(reviewer.email)) {
    recipients.push(reviewer.email);
  }

  const result = await sendEmail({
    to: [...new Set(recipients)],
    subject,
    html,
  });

  for (const email of recipients) {
    await admin.from("notification_log").insert({
      type: "holiday_work_decision",
      recipient_email: email,
      subject: `Holiday Work Request ${status}`,
      related_id: request_id,
      status: result.success ? "sent" : "failed",
    });
  }

  return NextResponse.json({ success: result.success });
}
