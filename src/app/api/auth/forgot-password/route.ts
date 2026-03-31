import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check if user exists
  const { data: user } = await admin
    .from("users")
    .select("full_name, email")
    .eq("email", email)
    .maybeSingle();

  if (!user) {
    // Don't reveal if user exists or not
    return NextResponse.json({ success: true });
  }

  // Get all super admins
  const { data: superAdmins } = await admin
    .from("users")
    .select("email, full_name")
    .eq("role", "super_admin")
    .eq("is_active", true);

  if (!superAdmins || superAdmins.length === 0) {
    return NextResponse.json({ success: true });
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const adminEmails = superAdmins.map((a) => a.email);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Password Reset Request</h2>
      <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #92400e;">
          <strong>${user.full_name || user.email}</strong> (${user.email}) is requesting a password reset.
        </p>
      </div>
      <p>Please go to the Users page to send them a password reset email.</p>
      <a href="${APP_URL}/admin/users" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Go to Users</a>
    </div>
  `;

  await sendEmail({
    to: adminEmails,
    subject: `Password Reset Request: ${user.full_name || user.email}`,
    html,
  });

  // Log it
  for (const adminEmail of adminEmails) {
    await admin.from("notification_log").insert({
      type: "attendance_flag", // reuse existing type for now
      recipient_email: adminEmail,
      subject: `Password Reset Request: ${user.full_name || user.email}`,
      status: "sent",
    });
  }

  return NextResponse.json({ success: true });
}
