-- Per-user gate: HR ticks this box for employees who may submit OT requests.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS overtime_eligible BOOLEAN NOT NULL DEFAULT false;

-- Overtime requests: extra hours on top of the regular shift, on a specific date.
CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT NOT NULL,
  status adjustment_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_overtime_employee ON public.overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_status ON public.overtime_requests(status);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON public.overtime_requests(requested_date);

ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;

-- Read own
DROP POLICY IF EXISTS overtime_read_own ON public.overtime_requests;
CREATE POLICY overtime_read_own ON public.overtime_requests
  FOR SELECT USING (employee_id = auth.uid());

-- Create own — and only if HR has flagged the user as eligible
DROP POLICY IF EXISTS overtime_create_own ON public.overtime_requests;
CREATE POLICY overtime_create_own ON public.overtime_requests
  FOR INSERT WITH CHECK (
    employee_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND overtime_eligible = true
    )
  );

-- Cancel own pending request
DROP POLICY IF EXISTS overtime_delete_own ON public.overtime_requests;
CREATE POLICY overtime_delete_own ON public.overtime_requests
  FOR DELETE USING (
    employee_id = auth.uid() AND status = 'pending'
  );

-- Reviewers (manager of the employee, or hr_admin/super_admin) can read
DROP POLICY IF EXISTS overtime_read_reports ON public.overtime_requests;
CREATE POLICY overtime_read_reports ON public.overtime_requests
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
  );

DROP POLICY IF EXISTS overtime_read_all ON public.overtime_requests;
CREATE POLICY overtime_read_all ON public.overtime_requests
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- Reviewers can approve/reject
DROP POLICY IF EXISTS overtime_update_reviewer ON public.overtime_requests;
CREATE POLICY overtime_update_reviewer ON public.overtime_requests
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
  );
