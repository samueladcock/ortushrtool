import { getCurrentUser } from "@/lib/auth/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight, Lock } from "lucide-react";
import { RequestPeerButton } from "@/components/performance/request-peer-button";
import type { Review, ReviewCycle } from "@/types/database";

export default async function PerformanceReviewsPage() {
  const user = await getCurrentUser();
  const admin = createAdminClient();

  const { data: reviewsData } = await admin
    .from("reviews")
    .select(
      "id, cycle_id, status, self_submitted_at, manager_submitted_at, signed_off_at"
    )
    .eq("employee_id", user.id)
    .order("created_at", { ascending: false });
  const myReviews = (reviewsData ?? []) as Pick<
    Review,
    | "id"
    | "cycle_id"
    | "status"
    | "self_submitted_at"
    | "manager_submitted_at"
    | "signed_off_at"
  >[];
  const { data: cycleRows } =
    myReviews.length > 0
      ? await admin
          .from("review_cycles")
          .select("*")
          .in(
            "id",
            myReviews.map((r) => r.cycle_id)
          )
      : { data: [] };
  const cyclesById = new Map<string, ReviewCycle>();
  for (const c of (cycleRows ?? []) as ReviewCycle[]) cyclesById.set(c.id, c);

  if (myReviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        You&apos;re not in any review cycle right now.
      </div>
    );
  }

  // Candidate reviewers for peer feedback = all active users except self
  const { data: candidatesData } = await admin
    .from("users")
    .select("id, full_name, preferred_name, first_name, last_name, email")
    .eq("is_active", true)
    .neq("id", user.id)
    .order("full_name");
  const peerCandidates = (candidatesData ?? []) as Array<{
    id: string;
    full_name: string;
    preferred_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
  }>;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <ul className="divide-y divide-gray-100">
        {myReviews.map((r) => {
          const c = cyclesById.get(r.cycle_id);
          const statusLabel =
            r.status === "signed_off"
              ? "Signed off"
              : r.status === "manager_done"
                ? "Manager done"
                : r.status === "self_done"
                  ? "Self done"
                  : "Not started";
          const statusStyles: Record<string, string> = {
            not_started: "bg-gray-100 text-gray-600",
            self_done: "bg-amber-100 text-amber-800",
            manager_done: "bg-blue-100 text-blue-800",
            signed_off: "bg-emerald-100 text-emerald-800",
          };
          const needsSelf =
            c?.status === "open" &&
            (r.status === "not_started" || r.status === "manager_done");
          const canRequestPeer = c?.status === "open" && !!c?.peer_due;
          return (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {c?.name ?? "(cycle missing)"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {c?.start_date && c?.end_date && (
                      <>
                        {format(parseISO(c.start_date), "MMM d")} –{" "}
                        {format(parseISO(c.end_date), "MMM d, yyyy")}
                      </>
                    )}
                    {c?.self_due && (
                      <> · self due {format(parseISO(c.self_due), "MMM d")}</>
                    )}
                    {c?.peer_due && (
                      <> · peer due {format(parseISO(c.peer_due), "MMM d")}</>
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusStyles[r.status]}`}
                >
                  {r.status === "signed_off" && (
                    <Lock size={10} className="mr-1 inline" />
                  )}
                  {statusLabel}
                </span>
                <Link
                  href={`/team/${user.id}/performance`}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    needsSelf
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {needsSelf ? "Fill self review" : "View"} <ArrowRight size={12} />
                </Link>
              </div>
              {canRequestPeer && (
                <div className="mt-2">
                  <RequestPeerButton
                    reviewId={r.id}
                    candidates={peerCandidates}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
