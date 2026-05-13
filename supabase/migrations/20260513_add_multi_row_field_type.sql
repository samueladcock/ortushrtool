-- Multi-row field type: a field that holds N rows per employee (e.g.
-- References, Education, Equipment). Each row is a JSON object keyed by
-- sub-field id. Sub-fields are defined as JSONB on profile_fields.

-- 1) Extend the field_type check to allow 'multi_row'.
ALTER TABLE public.profile_fields
  DROP CONSTRAINT IF EXISTS profile_fields_field_type_check;
ALTER TABLE public.profile_fields
  ADD CONSTRAINT profile_fields_field_type_check
  CHECK (field_type IN ('text', 'textarea', 'date', 'number', 'url', 'multi_row'));

-- 2) Sub-fields schema lives on the parent field as JSONB.
ALTER TABLE public.profile_fields
  ADD COLUMN IF NOT EXISTS subfields JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3) Rows-of-values table. data is { "<subfield_key>": "<value>", ... }.
CREATE TABLE IF NOT EXISTS public.profile_field_value_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES public.profile_fields(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  row_index INT NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pfvr_employee ON public.profile_field_value_rows(employee_id);
CREATE INDEX IF NOT EXISTS idx_pfvr_field ON public.profile_field_value_rows(field_id);

ALTER TABLE public.profile_field_value_rows ENABLE ROW LEVEL SECURITY;

-- Visibility for multi-row values mirrors single-value RLS.
DROP POLICY IF EXISTS pfvr_read ON public.profile_field_value_rows;
CREATE POLICY pfvr_read ON public.profile_field_value_rows
  FOR SELECT USING (
    employee_id = auth.uid()
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
    OR EXISTS (SELECT 1 FROM public.profile_fields f WHERE f.id = field_id AND f.visibility = 'everyone')
    OR (
      EXISTS (SELECT 1 FROM public.profile_fields f WHERE f.id = field_id AND f.visibility = 'manager_admin')
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = employee_id AND u.manager_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS pfvr_write_own ON public.profile_field_value_rows;
CREATE POLICY pfvr_write_own ON public.profile_field_value_rows
  FOR ALL USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS pfvr_write_admin ON public.profile_field_value_rows;
CREATE POLICY pfvr_write_admin ON public.profile_field_value_rows
  FOR ALL USING (public.get_user_role() IN ('hr_admin', 'super_admin'));

-- 4) Seed a built-in "References" multi-row field in the Employment section.
INSERT INTO public.profile_field_sections (name, sort_order, built_in_key)
VALUES ('References', -150, 'references')
ON CONFLICT (built_in_key) DO NOTHING;

INSERT INTO public.profile_fields (section_id, label, field_type, visibility, sort_order, built_in_key, subfields)
SELECT
  s.id,
  'References',
  'multi_row',
  'manager_admin',
  0,
  'references',
  '[
    {"key":"name","label":"Name","type":"text"},
    {"key":"relationship","label":"Relationship","type":"text"},
    {"key":"company","label":"Company","type":"text"},
    {"key":"email","label":"Email","type":"text"},
    {"key":"phone","label":"Phone","type":"text"},
    {"key":"notes","label":"Notes","type":"textarea"}
  ]'::jsonb
FROM public.profile_field_sections s
WHERE s.built_in_key = 'references'
ON CONFLICT (built_in_key) DO NOTHING;

-- 5) Migrate any existing data from employee_references → multi-row rows.
INSERT INTO public.profile_field_value_rows (field_id, employee_id, row_index, data, created_at, updated_at)
SELECT
  f.id,
  er.employee_id,
  ROW_NUMBER() OVER (PARTITION BY er.employee_id ORDER BY er.created_at) - 1,
  jsonb_strip_nulls(jsonb_build_object(
    'name', er.name,
    'relationship', er.relationship,
    'company', er.company,
    'email', er.email,
    'phone', er.phone,
    'notes', er.notes
  )),
  er.created_at,
  er.updated_at
FROM public.employee_references er
JOIN public.profile_fields f ON f.built_in_key = 'references'
WHERE NOT EXISTS (
  -- Don't double-migrate if already imported (idempotent re-runs)
  SELECT 1 FROM public.profile_field_value_rows existing
  WHERE existing.field_id = f.id AND existing.employee_id = er.employee_id
);
