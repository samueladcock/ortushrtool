-- Custom employee-profile fields. HR/super_admin defines sections (e.g.
-- "Equipment", "Emergency Contact") with fields under each, and each field
-- has a visibility level controlling who sees its values on the profile.

CREATE TABLE IF NOT EXISTS public.profile_field_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.profile_field_sections(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text', 'textarea', 'date', 'number', 'url')),
  visibility TEXT NOT NULL DEFAULT 'manager_admin'
    CHECK (visibility IN ('everyone', 'manager_admin', 'admin_only')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_fields_section
  ON public.profile_fields(section_id);

CREATE TABLE IF NOT EXISTS public.profile_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES public.profile_fields(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  value TEXT,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_field_values_employee
  ON public.profile_field_values(employee_id);
CREATE INDEX IF NOT EXISTS idx_profile_field_values_field
  ON public.profile_field_values(field_id);

ALTER TABLE public.profile_field_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_field_values ENABLE ROW LEVEL SECURITY;

-- Sections + fields: readable by everyone (the UI needs to render headers
-- and labels regardless of whether the viewer can see the value).
DROP POLICY IF EXISTS profile_field_sections_read ON public.profile_field_sections;
CREATE POLICY profile_field_sections_read ON public.profile_field_sections
  FOR SELECT USING (true);

DROP POLICY IF EXISTS profile_field_sections_write ON public.profile_field_sections;
CREATE POLICY profile_field_sections_write ON public.profile_field_sections
  FOR ALL USING (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS profile_fields_read ON public.profile_fields;
CREATE POLICY profile_fields_read ON public.profile_fields
  FOR SELECT USING (true);

DROP POLICY IF EXISTS profile_fields_write ON public.profile_fields;
CREATE POLICY profile_fields_write ON public.profile_fields
  FOR ALL USING (public.get_user_role() = 'super_admin');

-- Values: visibility-based read.
DROP POLICY IF EXISTS profile_field_values_read ON public.profile_field_values;
CREATE POLICY profile_field_values_read ON public.profile_field_values
  FOR SELECT USING (
    -- self
    employee_id = auth.uid()
    OR
    -- HR + super admin
    public.get_user_role() IN ('hr_admin', 'super_admin')
    OR
    -- "everyone" visibility
    EXISTS (
      SELECT 1 FROM public.profile_fields f
      WHERE f.id = field_id AND f.visibility = 'everyone'
    )
    OR
    -- "manager_admin" visibility AND viewer is the direct manager
    (
      EXISTS (
        SELECT 1 FROM public.profile_fields f
        WHERE f.id = field_id AND f.visibility = 'manager_admin'
      )
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = employee_id AND u.manager_id = auth.uid()
      )
    )
  );

-- Self + admins can write values.
DROP POLICY IF EXISTS profile_field_values_write_own ON public.profile_field_values;
CREATE POLICY profile_field_values_write_own ON public.profile_field_values
  FOR ALL USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS profile_field_values_write_admin ON public.profile_field_values;
CREATE POLICY profile_field_values_write_admin ON public.profile_field_values
  FOR ALL USING (public.get_user_role() IN ('hr_admin', 'super_admin'));
