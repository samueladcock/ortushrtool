import { requireRole } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { FeatureToggles } from "@/components/admin/feature-toggles";

export default async function FeatureVisibilityPage() {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .like("key", "coming_soon:%")
    .eq("value", "true");

  const comingSoonRoutes = (settings ?? []).map((s) =>
    s.key.replace("coming_soon:", "")
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Feature Visibility
        </h1>
        <p className="text-gray-600">
          Toggle features that are still in progress
        </p>
      </div>
      <FeatureToggles comingSoonRoutes={comingSoonRoutes} />
    </div>
  );
}
