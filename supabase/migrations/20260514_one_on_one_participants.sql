-- Allow 1-on-1s to have arbitrary participants (e.g. HR check-ins) on top of
-- the primary manager/employee pair, and allow standalone meetings without a
-- direct manager involved.
ALTER TABLE public.one_on_ones
  ALTER COLUMN manager_id DROP NOT NULL;

ALTER TABLE public.one_on_ones
  ADD COLUMN IF NOT EXISTS participants JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Update read policy to include participants[] and skip-level.
DROP POLICY IF EXISTS one_on_ones_read ON public.one_on_ones;
CREATE POLICY one_on_ones_read ON public.one_on_ones
  FOR SELECT USING (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.users mgr
      WHERE mgr.id = one_on_ones.manager_id
        AND mgr.manager_id = auth.uid()
    )
    OR participants @> to_jsonb(auth.uid()::text)
  );
