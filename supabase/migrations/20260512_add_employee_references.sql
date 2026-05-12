-- New hr_recruiter role: same access level as a regular employee (locked
-- out of manager+ pages), but with read access to employee references via
-- the dedicated /admin/references page.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr_recruiter';

-- One row per employee reference. Added by the recruiter after the hire is
-- finalised — just an archive, no workflow status.
CREATE TABLE IF NOT EXISTS public.employee_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_references_employee
  ON public.employee_references(employee_id);

ALTER TABLE public.employee_references ENABLE ROW LEVEL SECURITY;

-- Read: self
DROP POLICY IF EXISTS employee_references_read_own ON public.employee_references;
CREATE POLICY employee_references_read_own ON public.employee_references
  FOR SELECT USING (employee_id = auth.uid());

-- Read: direct manager
DROP POLICY IF EXISTS employee_references_read_manager ON public.employee_references;
CREATE POLICY employee_references_read_manager ON public.employee_references
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
  );

-- Read: hr_admin, super_admin, hr_recruiter
DROP POLICY IF EXISTS employee_references_read_hr ON public.employee_references;
CREATE POLICY employee_references_read_hr ON public.employee_references
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin', 'hr_recruiter')
  );

-- Write own
DROP POLICY IF EXISTS employee_references_write_own ON public.employee_references;
CREATE POLICY employee_references_write_own ON public.employee_references
  FOR ALL USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- Write hr_admin / super_admin (can edit anyone's references, including status)
DROP POLICY IF EXISTS employee_references_write_admin ON public.employee_references;
CREATE POLICY employee_references_write_admin ON public.employee_references
  FOR ALL USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- hr_recruiter can update status + notes on any reference (workflow tracking)
-- but cannot delete or change the reference identity itself.
DROP POLICY IF EXISTS employee_references_update_recruiter ON public.employee_references;
CREATE POLICY employee_references_update_recruiter ON public.employee_references
  FOR UPDATE USING (
    public.get_user_role() = 'hr_recruiter'
  );
