import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole, displayName } from "@/lib/utils";
import { sendEmail } from "@/lib/email/resend";

/**
 * Request peer feedback for a review.
 *
 * Auth:
 *  - The review's employee can request peers for themselves
 *  - The employee's direct manager / skip-level / HR admin+ can also nominate
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: caller } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { review_id, reviewer_id, anonymous } = body;
  if (!review_id || !reviewer_id) {
    return NextResponse.json(
      { error: "review_id and reviewer_id are required" },
      { status: 400 }
    );
  }
  if (reviewer_id === authUser.id) {
    return NextResponse.json(
      { error: "Cannot request feedback from yourself" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: review } = await admin
    .from("reviews")
    .select("id, employee_id")
    .eq("id", review_id)
    .single();
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const isAdmin = hasRole(caller.role, "hr_admin");
  const isSelf = review.employee_id === authUser.id;
  const { data: emp } = await admin
    .from("users")
    .select("manager_id")
    .eq("id", review.employee_id)
    .single();
  const isDirectManager = emp?.manager_id === authUser.id;
  let isSkipLevel = false;
  if (emp?.manager_id) {
    const { data: mgr } = await admin
      .from("users")
      .select("manager_id")
      .eq("id", emp.manager_id)
      .single();
    if (mgr?.manager_id === authUser.id) isSkipLevel = true;
  }
  if (!(isAdmin || isSelf || isDirectManager || isSkipLevel)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Avoid duplicates
  const { data: existing } = await admin
    .from("peer_feedback_requests")
    .select("id")
    .eq("review_id", review_id)
    .eq("reviewer_id", reviewer_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Already requested from this reviewer" },
      { status: 409 }
    );
  }

  const { data, error } = await admin
    .from("peer_feedback_requests")
    .insert({
      review_id,
      requested_by: authUser.id,
      reviewer_id,
      anonymous: anonymous !== false,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort email — don't block the response if it fails.
  (async () => {
    const [{ data: reviewer }, { data: target }, { data: requester }] =
      await Promise.all([
        admin
          .from("users")
          .select("email, full_name, preferred_name, first_name, last_name")
          .eq("id", reviewer_id)
          .single(),
        admin
          .from("users")
          .select("full_name, preferred_name, first_name, last_name, email")
          .eq("id", review.employee_id)
          .single(),
        admin
          .from("users")
          .select("full_name, preferred_name, first_name, last_name, email")
          .eq("id", authUser.id)
          .single(),
      ]);
    if (!reviewer?.email) return;
    const targetLabel = displayName(target ?? null);
    const requesterLabel = displayName(requester ?? null);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const link = `${appUrl}/performance/peer-requests/${data.id}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.5;">
        <p>Hi ${displayName(reviewer)},</p>
        <p><strong>${requesterLabel}</strong> has requested your feedback on
        <strong>${targetLabel}</strong>'s performance review.</p>
        <p>
          <a href="${link}" style="display:inline-block;padding:8px 14px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;">
            Open feedback form
          </a>
        </p>
        <p style="color:#666;font-size:12px;">
          Your response can be anonymous if you choose.
        </p>
      </div>
    `;
    await sendEmail({
      to: reviewer.email,
      subject: `Peer feedback requested — ${targetLabel}`,
      html,
    });
  })().catch(() => {});

  return NextResponse.json({ ok: true, request: data });
}
