-- Add an 'hr_only' visibility level for profile fields. Semantics:
--   - hr_admin, super_admin: always see
--   - hr_support: sees if visible_to_recruiter = true (same as today)
--   - the employee themselves: does NOT see (different from admin_only)
--   - direct manager: does NOT see
-- This is for HR-internal data the candidate shouldn't see (e.g.
-- recruitment notes).

ALTER TABLE public.profile_fields
  DROP CONSTRAINT IF EXISTS profile_fields_visibility_check;
ALTER TABLE public.profile_fields
  ADD CONSTRAINT profile_fields_visibility_check
  CHECK (visibility IN ('everyone', 'manager_admin', 'admin_only', 'hr_only'));

-- Scalar values RLS — replace the "self" branch with one that excludes
-- fields whose visibility is 'hr_only'.
DROP POLICY IF EXISTS profile_field_values_read ON public.profile_field_values;
CREATE POLICY profile_field_values_read ON public.profile_field_values
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
    OR (
      employee_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM public.profile_fields f
        WHERE f.id = field_id AND f.visibility = 'hr_only'
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profile_fields f
      WHERE f.id = field_id AND f.visibility = 'everyone'
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.profile_fields f
        WHERE f.id = field_id AND f.visibility = 'manager_admin'
      )
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = employee_id AND u.manager_id = auth.uid()
      )
    )
    OR (
      public.get_user_role() = 'hr_support'
      AND EXISTS (
        SELECT 1 FROM public.profile_fields f
        WHERE f.id = field_id AND f.visible_to_recruiter = true
      )
    )
  );

-- Multi-row values RLS — same change.
DROP POLICY IF EXISTS pfvr_read ON public.profile_field_value_rows;
CREATE POLICY pfvr_read ON public.profile_field_value_rows
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
    OR (
      employee_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM public.profile_fields f
        WHERE f.id = field_id AND f.visibility = 'hr_only'
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profile_fields f
      WHERE f.id = field_id AND f.visibility = 'everyone'
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.profile_fields f
        WHERE f.id = field_id AND f.visibility = 'manager_admin'
      )
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = employee_id AND u.manager_id = auth.uid()
      )
    )
    OR (
      public.get_user_role() = 'hr_support'
      AND EXISTS (
        SELECT 1 FROM public.profile_fields f
        WHERE f.id = field_id AND f.visible_to_recruiter = true
      )
    )
  );

-- Also restrict self-write for hr_only fields — the employee shouldn't be
-- editing their own recruitment data.
DROP POLICY IF EXISTS profile_field_values_write_own ON public.profile_field_values;
CREATE POLICY profile_field_values_write_own ON public.profile_field_values
  FOR ALL
  USING (
    employee_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profile_fields f
      WHERE f.id = field_id AND f.visibility = 'hr_only'
    )
  )
  WITH CHECK (
    employee_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profile_fields f
      WHERE f.id = field_id AND f.visibility = 'hr_only'
    )
  );

DROP POLICY IF EXISTS pfvr_write_own ON public.profile_field_value_rows;
CREATE POLICY pfvr_write_own ON public.profile_field_value_rows
  FOR ALL
  USING (
    employee_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profile_fields f
      WHERE f.id = field_id AND f.visibility = 'hr_only'
    )
  )
  WITH CHECK (
    employee_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profile_fields f
      WHERE f.id = field_id AND f.visibility = 'hr_only'
    )
  );
