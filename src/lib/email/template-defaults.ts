/**
 * Default email templates used to seed the database.
 * Each template uses {{variable}} placeholders that get replaced at send time.
 * Optional sections use {{#if variable}}...{{/if}} blocks.
 */

export interface EmailTemplateDefault {
  type: string;
  name: string;
  subject: string;
  body: string;
  variables: string;
}

function wrap(inner: string): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">\n${inner}\n</div>`;
}

function btn(label: string, url: string, color = "#2563eb"): string {
  return `<a href="${url}" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: ${color}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">${label}</a>`;
}

function row(label: string, value: string, bold = false): string {
  return `<tr><td style="padding: 8px 0; color: #6b7280;">${label}</td><td style="padding: 8px 0;${bold ? " font-weight: bold;" : ""}">${value}</td></tr>`;
}

function table(rows: string): string {
  return `<table style="width: 100%; border-collapse: collapse;">\n${rows}\n</table>`;
}

function statusBanner(message: string, approved: boolean): string {
  const bg = approved ? "#f0fdf4" : "#fef2f2";
  const border = approved ? "#bbf7d0" : "#fecaca";
  const color = approved ? "#166534" : "#991b1b";
  return `<div style="background: ${bg}; border: 1px solid ${border}; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0; font-weight: bold; color: ${color};">${message}</p>
  </div>`;
}

export const EMAIL_TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
  // ── Authentication ──
  {
    type: "welcome",
    name: "Welcome / Account Setup",
    subject: "Welcome to Ortus Club HR — Set Up Your Password",
    body: wrap([
      `<h2 style="color: #1f2937;">Welcome to Ortus Club HR</h2>`,
      `<p>Hi {{employee_name}},</p>`,
      `<p>Your account has been created. Please click the button below to set your password and get started:</p>`,
      btn("Set Up Your Password", "{{reset_link}}"),
      `<p style="margin-top: 16px; color: #6b7280; font-size: 14px;">If you have an @ortusclub.com email, you can also sign in directly with Google.</p>`,
    ].join("\n")),
    variables: "employee_name, reset_link",
  },
  {
    type: "password_reset",
    name: "Password Reset (Admin)",
    subject: "Reset Your Password — Ortus Club HR",
    body: wrap([
      `<h2 style="color: #1f2937;">Reset Your Password</h2>`,
      `<p>An administrator has initiated a password reset for your account.</p>`,
      `<p>Click the button below to set a new password:</p>`,
      btn("Reset Password", "{{reset_link}}"),
      `<p style="margin-top: 16px; color: #6b7280; font-size: 14px;">If you did not request this, you can ignore this email.</p>`,
    ].join("\n")),
    variables: "reset_link",
  },
  {
    type: "forgot_password_alert",
    name: "Forgot Password Alert (to Admins)",
    subject: "Password Reset Request: {{employee_name}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Password Reset Request</h2>`,
      `<div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">`,
      `  <p style="margin: 0; color: #92400e;"><strong>{{employee_name}}</strong> ({{employee_email}}) is requesting a password reset.</p>`,
      `</div>`,
      `<p>Please go to the Users page to send them a password reset email.</p>`,
      btn("Go to Users", "{{app_url}}/admin/users"),
    ].join("\n")),
    variables: "employee_name, employee_email, app_url",
  },

  // ── Leave ──
  {
    type: "leave_submitted",
    name: "Leave Request Submitted",
    subject: "Leave Request from {{employee_name}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Leave Request</h2>`,
      `<p>{{employee_name}} has submitted a leave request.</p>`,
      table([
        row("Type", "{{leave_type}}", true),
        row("From", "{{start_date}}"),
        row("To", "{{end_date}}"),
        row("Reason", "{{reason}}"),
      ].join("\n")),
      btn("Review Request", "{{app_url}}/requests", "#7c3aed"),
    ].join("\n")),
    variables: "employee_name, leave_type, start_date, end_date, reason, app_url",
  },
  {
    type: "leave_approved",
    name: "Leave Approved",
    subject: "Leave Approved: {{employee_name}} — {{leave_type}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Leave Request Approved</h2>`,
      statusBanner("{{employee_name}}'s {{leave_type}} request has been approved.", true),
      table([
        row("Employee", "{{employee_name}}", true),
        row("Type", "{{leave_type}}"),
        row("Dates", "{{start_date}} to {{end_date}}"),
        row("Reason", "{{reason}}"),
      ].join("\n")),
      `{{#if notes}}<p><strong>Notes:</strong> {{notes}}</p>{{/if}}`,
      btn("View in App", "{{app_url}}/requests"),
    ].join("\n")),
    variables: "employee_name, leave_type, start_date, end_date, reason, notes, app_url",
  },
  {
    type: "leave_rejected",
    name: "Leave Rejected",
    subject: "Leave Rejected: {{employee_name}} — {{leave_type}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Leave Request Rejected</h2>`,
      statusBanner("{{employee_name}}'s {{leave_type}} request has been rejected.", false),
      table([
        row("Employee", "{{employee_name}}", true),
        row("Type", "{{leave_type}}"),
        row("Dates", "{{start_date}} to {{end_date}}"),
        row("Reason", "{{reason}}"),
      ].join("\n")),
      `{{#if notes}}<p><strong>Notes:</strong> {{notes}}</p>{{/if}}`,
      btn("View in App", "{{app_url}}/requests"),
    ].join("\n")),
    variables: "employee_name, leave_type, start_date, end_date, reason, notes, app_url",
  },

  // ── Schedule Adjustments ──
  {
    type: "adjustment_submitted",
    name: "Schedule Adjustment Submitted",
    subject: "Schedule Adjustment Request from {{employee_name}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Schedule Adjustment Request</h2>`,
      `<p>{{employee_name}} has requested a schedule adjustment.</p>`,
      table([
        row("Date", "{{requested_date}}"),
        row("Original Schedule", "{{original_time}}"),
        row("Requested Schedule", "{{requested_time}}", true),
        row("Reason", "{{reason}}"),
      ].join("\n")),
      btn("Review Request", "{{app_url}}/adjustments"),
    ].join("\n")),
    variables: "employee_name, requested_date, original_time, requested_time, reason, app_url",
  },
  {
    type: "adjustment_approved",
    name: "Schedule Adjustment Approved",
    subject: "Schedule Adjustment Approved — {{employee_name}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Schedule Adjustment Approved</h2>`,
      statusBanner("Your schedule adjustment request for {{requested_date}} has been approved.", true),
      `<p><strong>Requested Schedule:</strong> {{requested_time}}</p>`,
      `{{#if notes}}<p><strong>Manager Notes:</strong> {{notes}}</p>{{/if}}`,
      btn("View Details", "{{app_url}}/adjustments"),
    ].join("\n")),
    variables: "employee_name, requested_date, requested_time, notes, app_url",
  },
  {
    type: "adjustment_rejected",
    name: "Schedule Adjustment Rejected",
    subject: "Schedule Adjustment Rejected — {{employee_name}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Schedule Adjustment Rejected</h2>`,
      statusBanner("Your schedule adjustment request for {{requested_date}} has been rejected.", false),
      `<p><strong>Requested Schedule:</strong> {{requested_time}}</p>`,
      `{{#if notes}}<p><strong>Manager Notes:</strong> {{notes}}</p>{{/if}}`,
      btn("View Details", "{{app_url}}/adjustments"),
    ].join("\n")),
    variables: "employee_name, requested_date, requested_time, notes, app_url",
  },

  // ── Holiday Work ──
  {
    type: "holiday_work_submitted",
    name: "Holiday Work Request Submitted",
    subject: "Holiday Work Request from {{employee_name}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Work on Holiday Request</h2>`,
      `<p>{{employee_name}} is requesting to work on a holiday.</p>`,
      table([
        row("Holiday", "{{holiday_name}}", true),
        row("Date", "{{holiday_date}}"),
        row("Hours", "{{start_time}} - {{end_time}}"),
        row("Location", "{{location}}"),
        row("Reason", "{{reason}}"),
      ].join("\n")),
      btn("Review Request", "{{app_url}}/requests", "#0d9488"),
    ].join("\n")),
    variables: "employee_name, holiday_name, holiday_date, start_time, end_time, location, reason, app_url",
  },
  {
    type: "holiday_work_approved",
    name: "Holiday Work Approved",
    subject: "Holiday Work Approved: {{employee_name}} — {{holiday_name}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Holiday Work Request Approved</h2>`,
      statusBanner("{{employee_name}}'s request to work on {{holiday_name}} has been approved.", true),
      table([
        row("Employee", "{{employee_name}}", true),
        row("Holiday", "{{holiday_name}}"),
        row("Date", "{{holiday_date}}"),
        row("Hours", "{{start_time}} - {{end_time}}"),
        row("Location", "{{location}}"),
      ].join("\n")),
      `{{#if notes}}<p><strong>Notes:</strong> {{notes}}</p>{{/if}}`,
      btn("View in App", "{{app_url}}/requests"),
    ].join("\n")),
    variables: "employee_name, holiday_name, holiday_date, start_time, end_time, location, notes, app_url",
  },
  {
    type: "holiday_work_rejected",
    name: "Holiday Work Rejected",
    subject: "Holiday Work Rejected: {{employee_name}} — {{holiday_name}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Holiday Work Request Rejected</h2>`,
      statusBanner("{{employee_name}}'s request to work on {{holiday_name}} has been rejected.", false),
      table([
        row("Employee", "{{employee_name}}", true),
        row("Holiday", "{{holiday_name}}"),
        row("Date", "{{holiday_date}}"),
        row("Hours", "{{start_time}} - {{end_time}}"),
        row("Location", "{{location}}"),
      ].join("\n")),
      `{{#if notes}}<p><strong>Notes:</strong> {{notes}}</p>{{/if}}`,
      btn("View in App", "{{app_url}}/requests"),
    ].join("\n")),
    variables: "employee_name, holiday_name, holiday_date, start_time, end_time, location, notes, app_url",
  },

  // ── Attendance ──
  {
    type: "attendance_flag",
    name: "Attendance Flag",
    subject: "Attendance Flag: {{employee_name}} - {{flag_type}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Attendance Flag</h2>`,
      `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">`,
      `  <p style="margin: 0; font-weight: bold; color: #991b1b;">{{flag_type}}</p>`,
      `</div>`,
      table([
        row("Employee", "{{employee_name}}", true),
        row("Date", "{{flag_date}}"),
        row("Scheduled Time", "{{scheduled_time}}"),
        `{{#if actual_time}}` + row("Actual Time", "{{actual_time}}") + `{{/if}}`,
        row("Deviation", "{{deviation_minutes}} minutes"),
      ].join("\n")),
      btn("View in App", "{{app_url}}/flags"),
    ].join("\n")),
    variables: "employee_name, flag_date, flag_type, scheduled_time, actual_time, deviation_minutes, app_url",
  },

  // ── Reminders ──
  {
    type: "reminder",
    name: "Pending Approval Reminder",
    subject: "Reminder: {{request_type}} Request from {{employee_name}}",
    body: wrap([
      `<h2 style="color: #1f2937;">Pending Approval Reminder</h2>`,
      `<p>{{employee_name}} is waiting for your approval on a pending request.</p>`,
      table("{{details}}"),
      btn("Review Request", "{{app_url}}/requests"),
    ].join("\n")),
    variables: "employee_name, request_type, details, app_url",
  },
];
