import { requireRole } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { QuickExports } from "@/components/reports/quick-exports";
import { ReportBuilder } from "@/components/reports/report-builder";
import type { FilterValues } from "@/lib/reports/sources";

export default async function ReportsPage() {
  await requireRole("hr_admin");
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("report_templates")
    .select(
      "id, name, source, columns, filters, created_at, creator:users!report_templates_created_by_fkey(full_name)"
    )
    .order("created_at", { ascending: false });

  const normalised = (templates ?? []).map((t) => {
    const creator = (t as { creator?: unknown }).creator as
      | { full_name?: string }
      | { full_name?: string }[]
      | null
      | undefined;
    const createdByName = Array.isArray(creator)
      ? creator[0]?.full_name
      : creator?.full_name;
    return {
      id: t.id,
      name: t.name,
      source: t.source,
      columns: (t.columns ?? []) as string[],
      filters: (t.filters ?? {}) as FilterValues,
      created_at: t.created_at,
      created_by_name: createdByName ?? undefined,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600">
          Quick links to pages with built-in filter + export, plus a custom CSV
          builder for everything else (leave / overtime / holiday-work /
          schedule adjustment requests, time-off balances, etc.). Templates are
          shared across HR.
        </p>
      </div>
      <QuickExports />
      <ReportBuilder initialTemplates={normalised} />
    </div>
  );
}
