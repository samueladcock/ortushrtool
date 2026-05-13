import { getCurrentUser } from "@/lib/auth/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole, displayName } from "@/lib/utils";
import { redirect } from "next/navigation";
import { KudosPanel } from "@/components/performance/kudos-panel";
import { OneOnOnesPanel } from "@/components/performance/one-on-ones-panel";
import { ReviewForm } from "@/components/performance/review-form";
import { PeerRequestPanel } from "@/components/performance/peer-request-panel";
import type {
  KudosWithUsers,
  OneOnOne,
  Review,
  ReviewCycle,
  ReviewFormTemplate,
  PeerFeedbackRequest,
} from "@/types/database";

export default async function TeamMemberPerformanceTab({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const currentUser = await getCurrentUser();
  const { userId } = await params;
  const isOwnProfile = currentUser.id === userId;
  const isAdmin = hasRole(currentUser.role, "hr_admin");
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("id, full_name, preferred_name, first_name, last_name, email, manager_id")
    .eq("id", userId)
    .single();
  if (!user) return null;

  const isDirectManager = user.manager_id === currentUser.id;
  let isSkipLevel = false;
  if (user.manager_id) {
    const { data: mgr } = await supabase
      .from("users")
      .select("manager_id")
      .eq("id", user.manager_id)
      .single();
    if (mgr?.manager_id === currentUser.id) isSkipLevel = true;
  }
  const canSee = isAdmin || isOwnProfile || isDirectManager || isSkipLevel;
  if (!canSee) redirect(`/team/${userId}`);

  const employeeLabel = displayName(user);

  const viewerRole: "manager" | "employee" | "skip_level" | "hr_admin" =
    isAdmin
      ? "hr_admin"
      : isOwnProfile
        ? "employee"
        : isDirectManager
          ? "manager"
          : "skip_level";

  // Kudos for this employee — filter on the server based on viewer role.
  const { data: rawKudos } = await supabase
    .from("kudos")
    .select(
      "*, sender:users!kudos_sender_id_fkey(full_name, preferred_name, email), recipient:users!kudos_recipient_id_fkey(full_name, preferred_name, email)"
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });

  type RawKudosRow = Omit<KudosWithUsers, "sender" | "recipient"> & {
    sender:
      | Array<{ full_name: string; preferred_name: string | null; email: string }>
      | null;
    recipient:
      | Array<{ full_name: string; preferred_name: string | null; email: string }>
      | null;
  };
  const normalize = <T extends { full_name: string; preferred_name: string | null; email: string }>(
    v: T[] | T | null | undefined
  ): T | null => (Array.isArray(v) ? v[0] ?? null : (v ?? null));
  const kudosAll: KudosWithUsers[] = ((rawKudos ?? []) as unknown as RawKudosRow[]).map(
    (k) => ({
      ...k,
      sender: normalize(k.sender),
      recipient: normalize(k.recipient),
    })
  );
  const kudos = kudosAll.filter((k) => {
    if (k.visibility === "public") return true;
    if (isAdmin) return true;
    if (isOwnProfile) return true; // recipient
    if (k.sender_id === currentUser.id) return true;
    return false;
  });

  // 1-on-1s
  const { data: oneOnOnes } = await supabase
    .from("one_on_ones")
    .select("*")
    .eq("employee_id", userId)
    .order("scheduled_date", { ascending: false });
  const oneOnOnesList = (oneOnOnes ?? []) as OneOnOne[];

  // Strip private notes the viewer isn't allowed to see.
  const filteredOneOnOnes = oneOnOnesList.map((o) => {
    const out = { ...o };
    if (!(isAdmin || o.manager_id === currentUser.id)) {
      out.manager_private_notes = null;
    }
    if (!(isAdmin || o.employee_id === currentUser.id)) {
      out.employee_private_notes = null;
    }
    return out;
  });

  const canGiveKudos = currentUser.id !== userId;
  const canScheduleOneOnOne =
    isAdmin || isDirectManager || isSkipLevel || isOwnProfile;
  const canDeleteOneOnOne = isAdmin || isDirectManager;

  // Active users for the 1-on-1 attendee picker + name lookup index.
  const { data: allActiveUsers } = await supabase
    .from("users")
    .select(
      "id, full_name, preferred_name, first_name, last_name, email, is_active"
    )
    .eq("is_active", true)
    .order("full_name");
  const oneOnOneCandidates = (allActiveUsers ?? []) as Array<{
    id: string;
    full_name: string;
    preferred_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
  }>;
  const oneOnOneUserIndex: Record<string, (typeof oneOnOneCandidates)[number]> = {};
  for (const u of oneOnOneCandidates) oneOnOneUserIndex[u.id] = u;

  // ─── Reviews + cycle context ────────────────────────────────────────────
  const { data: reviewsData } = await supabase
    .from("reviews")
    .select("*")
    .eq("employee_id", userId);
  const reviewsList = (reviewsData ?? []) as Review[];
  const cycleIds = reviewsList.map((r) => r.cycle_id);

  const [{ data: cyclesData }, { data: templatesData }] = await Promise.all([
    cycleIds.length > 0
      ? supabase.from("review_cycles").select("*").in("id", cycleIds)
      : Promise.resolve({ data: [] }),
    supabase.from("review_form_templates").select("*"),
  ]);
  const cyclesById = new Map<string, ReviewCycle>();
  for (const c of (cyclesData ?? []) as ReviewCycle[]) cyclesById.set(c.id, c);
  const templatesById = new Map<string, ReviewFormTemplate>();
  for (const t of (templatesData ?? []) as ReviewFormTemplate[]) {
    templatesById.set(t.id, t);
  }

  type PeerRow = Omit<PeerFeedbackRequest, "response"> & {
    response: Record<string, { rating: number | null; comment: string }>;
    reviewer:
      | Array<{ full_name: string; preferred_name: string | null; email: string }>
      | null;
  };
  const reviewIds = reviewsList.map((r) => r.id);
  const { data: peerData } =
    reviewIds.length > 0
      ? await supabase
          .from("peer_feedback_requests")
          .select(
            "*, reviewer:users!peer_feedback_requests_reviewer_id_fkey(full_name, preferred_name, email)"
          )
          .in("review_id", reviewIds)
      : { data: [] };
  const peersByReview = new Map<string, PeerRow[]>();
  for (const p of (peerData ?? []) as unknown as PeerRow[]) {
    const list = peersByReview.get(p.review_id) ?? [];
    list.push(p);
    peersByReview.set(p.review_id, list);
  }

  const reviewBlocks = reviewsList
    .map((r) => {
      const cycle = cyclesById.get(r.cycle_id);
      const template = cycle?.template_id
        ? templatesById.get(cycle.template_id)
        : null;
      if (!cycle || !template) return null;
      // Determine viewer's mode:
      // - own profile + cycle open → "self" (or "view" if already signed off)
      // - manager/skip/admin + cycle open → "manager"
      // - cycle closed → "view"
      let mode: "self" | "manager" | "view" = "view";
      if (cycle.status === "open" && r.status !== "signed_off") {
        if (isOwnProfile) mode = "self";
        else if (isDirectManager || isSkipLevel || isAdmin) mode = "manager";
      }
      return {
        review: r,
        cycle,
        template,
        mode,
        peerRequests: peersByReview.get(r.id) ?? [],
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Candidates for peer feedback: all active employees except the employee
  // themselves. (We could refine later — e.g. exclude direct manager.)
  const { data: candidatesData } = await supabase
    .from("users")
    .select("id, full_name, preferred_name, email")
    .eq("is_active", true)
    .neq("id", userId)
    .order("full_name");
  const peerCandidates =
    (candidatesData ?? []) as Array<{
      id: string;
      full_name: string;
      preferred_name: string | null;
      email: string;
    }>;

  return (
    <div className="space-y-6">
      <KudosPanel
        employeeId={userId}
        employeeLabel={employeeLabel}
        initialKudos={kudos}
        canGive={canGiveKudos}
        currentUserId={currentUser.id}
        canModerate={isAdmin}
      />
      <OneOnOnesPanel
        employeeId={userId}
        oneOnOnes={filteredOneOnOnes}
        canCreate={canScheduleOneOnOne}
        canDelete={canDeleteOneOnOne}
        viewerId={currentUser.id}
        viewerRole={viewerRole}
        participantCandidates={oneOnOneCandidates}
        userIndex={oneOnOneUserIndex}
      />

      {reviewBlocks.map((block) => (
        <div key={block.review.id} className="space-y-3">
          <ReviewForm
            review={block.review}
            template={block.template}
            mode={block.mode}
            cycleName={block.cycle.name}
            cycleSelfDue={block.cycle.self_due}
            cycleManagerDue={block.cycle.manager_due}
            peerFeedback={block.peerRequests.map((p) => ({
              ...p,
              reviewer:
                Array.isArray((p as { reviewer?: unknown }).reviewer) &&
                ((p as { reviewer?: unknown[] }).reviewer as unknown[]).length > 0
                  ? ((p as { reviewer?: unknown[] }).reviewer as Array<{
                      full_name: string;
                      preferred_name: string | null;
                      email: string;
                    }>)[0]
                  : null,
            }))}
          />
          {block.cycle.peer_due !== null && (
            <PeerRequestPanel
              reviewId={block.review.id}
              requests={block.peerRequests.map((p) => ({
                ...p,
                reviewer:
                  Array.isArray((p as { reviewer?: unknown }).reviewer) &&
                  ((p as { reviewer?: unknown[] }).reviewer as unknown[]).length > 0
                    ? ((p as { reviewer?: unknown[] }).reviewer as Array<{
                        full_name: string;
                        preferred_name: string | null;
                        email: string;
                      }>)[0]
                    : null,
              }))}
              canRequest={
                isOwnProfile || isDirectManager || isSkipLevel || isAdmin
              }
              candidates={peerCandidates}
            />
          )}
        </div>
      ))}
    </div>
  );
}
