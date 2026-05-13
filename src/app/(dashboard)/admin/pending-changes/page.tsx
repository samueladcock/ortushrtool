import { requireRole } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { PendingChangesQueue } from "@/components/admin/pending-changes-queue";
import type { PendingChangeWithRequester } from "@/types/database";

export default async function PendingChangesPage() {
  await requireRole("hr_admin");
  const supabase = await createClient();

  const { data: changes } = await supabase
    .from("pending_changes")
    .select(
      "*, requester:users!pending_changes_requested_by_fkey(full_name, preferred_name, first_name, last_name, email), target:users!pending_changes_target_employee_id_fkey(full_name, preferred_name, first_name, last_name, email), decider:users!pending_changes_decided_by_fkey(full_name, email)"
    )
    .order("requested_at", { ascending: false });

  const all = (changes ?? []) as PendingChangeWithRequester[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pending Changes</h1>
        <p className="text-gray-600">
          Review changes submitted by HR support. Approving applies them to the
          database; rejecting discards them. Decisions are logged.
        </p>
      </div>
      <PendingChangesQueue initialChanges={all} />
    </div>
  );
}
