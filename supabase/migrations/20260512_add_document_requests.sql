-- Document requests: employees can request HR-issued documents (COE, travel
-- letter, leave certificate, contract copy, or anything else).
CREATE TABLE IF NOT EXISTS public.document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Document type. "other" lets the employee specify in custom_document_name.
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'certificate_of_employment',
      'purpose_of_travel',
      'leave_certificate',
      'contract_copy',
      'other'
    )
  ),
  custom_document_name TEXT,                  -- only for document_type = 'other'
  addressee TEXT NOT NULL,                    -- always required
  additional_details TEXT,                    -- always optional
  -- Purpose-of-travel fields
  event_tag TEXT,
  event_city TEXT,
  event_country TEXT,
  event_date DATE,
  event_name TEXT,
  -- Leave-certificate fields
  leave_start_date DATE,
  leave_end_date DATE,
  -- Workflow
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'cancelled')),
  processed_by UUID REFERENCES public.users(id),
  processed_at TIMESTAMPTZ,
  processor_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_requests_employee
  ON public.document_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_status
  ON public.document_requests(status);
CREATE INDEX IF NOT EXISTS idx_document_requests_created
  ON public.document_requests(created_at DESC);

ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

-- Read own
DROP POLICY IF EXISTS document_requests_read_own ON public.document_requests;
CREATE POLICY document_requests_read_own ON public.document_requests
  FOR SELECT USING (employee_id = auth.uid());

-- Read all (HR + super admins)
DROP POLICY IF EXISTS document_requests_read_all ON public.document_requests;
CREATE POLICY document_requests_read_all ON public.document_requests
  FOR SELECT USING (public.get_user_role() IN ('hr_admin', 'super_admin'));

-- Create own
DROP POLICY IF EXISTS document_requests_create_own ON public.document_requests;
CREATE POLICY document_requests_create_own ON public.document_requests
  FOR INSERT WITH CHECK (employee_id = auth.uid());

-- Cancel own pending request
DROP POLICY IF EXISTS document_requests_delete_own ON public.document_requests;
CREATE POLICY document_requests_delete_own ON public.document_requests
  FOR DELETE USING (employee_id = auth.uid() AND status = 'pending');

-- HR can update (mark processed, add notes)
DROP POLICY IF EXISTS document_requests_update_hr ON public.document_requests;
CREATE POLICY document_requests_update_hr ON public.document_requests
  FOR UPDATE USING (public.get_user_role() IN ('hr_admin', 'super_admin'));
