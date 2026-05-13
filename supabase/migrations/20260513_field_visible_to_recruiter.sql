-- Per-field "also visible to hr_recruiter" toggle. Independent of the main
-- visibility setting — if true, recruiters can see this field even when the
-- primary visibility (everyone / manager_admin / admin_only) excludes them.
ALTER TABLE public.profile_fields
  ADD COLUMN IF NOT EXISTS visible_to_recruiter BOOLEAN NOT NULL DEFAULT false;

-- References is the canonical recruiter-visible field; turn it on by default.
UPDATE public.profile_fields
SET visible_to_recruiter = true
WHERE built_in_key = 'references';

-- Extend RLS on the scalar values table.
DROP POLICY IF EXISTS profile_field_values_read ON public.profile_field_values;
CREATE POLICY profile_field_values_read ON public.profile_field_values
  FOR SELECT USING (
    employee_id = auth.uid()
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
    OR EXISTS (SELECT 1 FROM public.profile_fields f WHERE f.id = field_id AND f.visibility = 'everyone')
    OR (
      EXISTS (SELECT 1 FROM public.profile_fields f WHERE f.id = field_id AND f.visibility = 'manager_admin')
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = employee_id AND u.manager_id = auth.uid())
    )
    OR (
      public.get_user_role() = 'hr_recruiter'
      AND EXISTS (SELECT 1 FROM public.profile_fields f WHERE f.id = field_id AND f.visible_to_recruiter = true)
    )
  );

-- Same change for the multi-row values table.
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
    OR (
      public.get_user_role() = 'hr_recruiter'
      AND EXISTS (SELECT 1 FROM public.profile_fields f WHERE f.id = field_id AND f.visible_to_recruiter = true)
    )
  );
