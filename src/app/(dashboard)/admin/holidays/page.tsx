import { requireRole } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { HolidayManager } from "@/components/admin/holiday-manager";

export default async function AdminHolidaysPage() {
  await requireRole("hr_admin");
  const supabase = await createClient();

  const { data: holidays } = await supabase
    .from("holidays")
    .select("*")
    .order("date", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Holidays</h1>
        <p className="text-gray-600">
          Add, edit, and remove public holidays for all office locations
        </p>
      </div>
      <HolidayManager holidays={holidays ?? []} />
    </div>
  );
}
