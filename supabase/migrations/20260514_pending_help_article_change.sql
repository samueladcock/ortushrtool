-- Allow 'help_article_change' as a pending_changes change_type so HR support
-- edits to the Help & Guide can be queued for admin approval.
ALTER TABLE public.pending_changes
  DROP CONSTRAINT IF EXISTS pending_changes_change_type_check;
ALTER TABLE public.pending_changes
  ADD CONSTRAINT pending_changes_change_type_check
  CHECK (change_type IN (
    'bulk_import',
    'field_value_upsert',
    'field_value_delete',
    'multi_row_insert',
    'multi_row_update',
    'multi_row_delete',
    'schedule_weekly_change',
    'help_article_change'
  ));
