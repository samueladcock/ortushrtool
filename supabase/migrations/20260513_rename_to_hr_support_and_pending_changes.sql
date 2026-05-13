-- 1) Rename the role enum value hr_recruiter → hr_support.
ALTER TYPE user_role RENAME VALUE 'hr_recruiter' TO 'hr_support';

-- 2) Pending-changes queue. HR support's write actions are not applied
--    directly; they create a row here for admin review.
CREATE TABLE IF NOT EXISTS public.pending_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES public.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  /**
   * What this change does. The `apply` step on approval reads `payload`
   * according to the type.
   */
  change_type TEXT NOT NULL CHECK (change_type IN (
    'bulk_import',
    'field_value_upsert',
    'field_value_delete',
    'multi_row_insert',
    'multi_row_update',
    'multi_row_delete'
  )),
  /** Optional pointer for grouping queue items by subject. */
  target_employee_id UUID REFERENCES public.users(id),
  /** Short human-readable summary for the queue. */
  description TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by UUID REFERENCES public.users(id),
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  applied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_changes_status
  ON public.pending_changes(status);
CREATE INDEX IF NOT EXISTS idx_pending_changes_requested_by
  ON public.pending_changes(requested_by);
CREATE INDEX IF NOT EXISTS idx_pending_changes_target
  ON public.pending_changes(target_employee_id);

ALTER TABLE public.pending_changes ENABLE ROW LEVEL SECURITY;

-- HR support can read their own pending changes.
DROP POLICY IF EXISTS pending_changes_read_own ON public.pending_changes;
CREATE POLICY pending_changes_read_own ON public.pending_changes
  FOR SELECT USING (requested_by = auth.uid());

-- HR admin + super admin can read every pending change.
DROP POLICY IF EXISTS pending_changes_read_admin ON public.pending_changes;
CREATE POLICY pending_changes_read_admin ON public.pending_changes
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- All write paths go through the application using the admin client. Lock
-- RLS down: nobody writes directly.
