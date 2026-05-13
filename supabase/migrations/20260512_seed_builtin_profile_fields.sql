-- Mark some sections and fields as "built-in": they map to columns on the
-- users table rather than to profile_field_values, and HR can adjust their
-- visibility but not rename / retype / delete them.
ALTER TABLE public.profile_field_sections
  ADD COLUMN IF NOT EXISTS built_in_key TEXT UNIQUE;

ALTER TABLE public.profile_fields
  ADD COLUMN IF NOT EXISTS built_in_key TEXT UNIQUE;

-- Seed default sections
INSERT INTO public.profile_field_sections (name, sort_order, built_in_key)
VALUES
  ('Identity',   -300, 'identity'),
  ('Employment', -200, 'employment'),
  ('Personal',   -100, 'personal')
ON CONFLICT (built_in_key) DO NOTHING;

-- Seed built-in fields. Visibility matches what the profile page already
-- shows today: everyone can see most fields; end-date is admin-only.
INSERT INTO public.profile_fields (section_id, label, field_type, visibility, sort_order, built_in_key)
SELECT s.id, v.label, v.field_type, v.visibility, v.sort_order, v.built_in_key
FROM public.profile_field_sections s
JOIN (VALUES
  ('identity',   'Full Name',           'text', 'everyone',      0,  'full_name'),
  ('identity',   'Preferred Name',      'text', 'everyone',      10, 'preferred_name'),
  ('identity',   'First Name',          'text', 'everyone',      20, 'first_name'),
  ('identity',   'Middle Name',         'text', 'everyone',      30, 'middle_name'),
  ('identity',   'Last Name',           'text', 'everyone',      40, 'last_name'),
  ('identity',   'Email',               'text', 'everyone',      50, 'email'),
  ('employment', 'Role',                'text', 'everyone',      0,  'role'),
  ('employment', 'Department',          'text', 'everyone',      10, 'department'),
  ('employment', 'Job Title',           'text', 'everyone',      20, 'job_title'),
  ('employment', 'Manager',             'text', 'everyone',      30, 'manager_id'),
  ('employment', 'Hire Date',           'date', 'everyone',      40, 'hire_date'),
  ('employment', 'Regularization Date', 'date', 'manager_admin', 50, 'regularization_date'),
  ('employment', 'End Date',            'date', 'admin_only',    60, 'end_date'),
  ('employment', 'Active',              'text', 'everyone',      70, 'is_active'),
  ('employment', 'Overtime Eligible',   'text', 'manager_admin', 80, 'overtime_eligible'),
  ('personal',   'Birthday',            'date', 'everyone',      0,  'birthday'),
  ('personal',   'Country',             'text', 'everyone',      10, 'holiday_country'),
  ('personal',   'Timezone',            'text', 'everyone',      20, 'timezone'),
  ('personal',   'Location',            'text', 'everyone',      30, 'location')
) AS v(section_built_in, label, field_type, visibility, sort_order, built_in_key)
  ON s.built_in_key = v.section_built_in
ON CONFLICT (built_in_key) DO NOTHING;
