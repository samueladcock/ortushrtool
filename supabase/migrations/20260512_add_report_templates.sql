-- Shared HR report-template configs. Used by /reports to remember which
-- columns + filters someone selected for a given data source.
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_templates_read_hr ON public.report_templates;
CREATE POLICY report_templates_read_hr ON public.report_templates
  FOR SELECT USING (public.get_user_role() IN ('hr_admin', 'super_admin'));

DROP POLICY IF EXISTS report_templates_write_hr ON public.report_templates;
CREATE POLICY report_templates_write_hr ON public.report_templates
  FOR ALL USING (public.get_user_role() IN ('hr_admin', 'super_admin'));
