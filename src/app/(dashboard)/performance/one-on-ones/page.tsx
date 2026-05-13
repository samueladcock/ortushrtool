import { getCurrentUser } from "@/lib/auth/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { OneOnOnesStandalone } from "@/components/performance/one-on-ones-standalone";
import { hasRole } from "@/lib/utils";
import type { OneOnOne } from "@/types/database";

/**
 * Personal 1-on-1s view inside /performance. Shows 1-on-1s the viewer is part
 * of (as subject, manager-of-record, or other participant). Managers and
 * above can also visit `/one-on-ones` for the same UI plus the ability to
 * see everything they have access to without going through a profile.
 */
export default async function PerformanceOneOnOnesPage() {
  const user = await getCurrentUser();
  const isAdmin = hasRole(user.role, "hr_admin");
  const admin = createAdminClient();

  const { data: oneOnOnes } = await admin
    .from("one_on_ones")
    .select("*")
    .or(
      `employee_id.eq.${user.id},manager_id.eq.${user.id},participants.cs.["${user.id}"]`
    )
    .order("scheduled_date", { ascending: false });

  const { data: candidates } = await admin
    .from("users")
    .select(
      "id, full_name, preferred_name, first_name, last_name, email, is_active"
    )
    .eq("is_active", true)
    .order("full_name");
  const candidatesList = (candidates ?? []) as Array<{
    id: string;
    full_name: string;
    preferred_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
  }>;
  const userIndex: Record<string, (typeof candidatesList)[number]> = {};
  for (const u of candidatesList) userIndex[u.id] = u;

  return (
    <OneOnOnesStandalone
      viewerId={user.id}
      isAdmin={isAdmin}
      oneOnOnes={(oneOnOnes ?? []) as OneOnOne[]}
      candidates={candidatesList}
      userIndex={userIndex}
    />
  );
}
