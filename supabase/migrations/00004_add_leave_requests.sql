-- Leave request types
CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'personal', 'unpaid', 'other');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

-- Leave requests table
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status leave_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leave_employee ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_status ON public.leave_requests(status);
CREATE INDEX idx_leave_dates ON public.leave_requests(start_date, end_date);

-- RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY leave_read_own ON public.leave_requests
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY leave_create_own ON public.leave_requests
  FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY leave_read_reports ON public.leave_requests
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
  );

CREATE POLICY leave_update_manager ON public.leave_requests
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
  );

CREATE POLICY leave_read_all ON public.leave_requests
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );
