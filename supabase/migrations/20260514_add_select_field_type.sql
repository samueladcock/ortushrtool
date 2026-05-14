-- Add a 'select' field type (single-choice dropdown). Options are stored
-- as a JSONB array of strings on the field itself, e.g. ["Single",
-- "Married", "Divorced", "Widowed"]. The value goes into the existing
-- profile_field_values.value text column.

ALTER TABLE public.profile_fields
  DROP CONSTRAINT IF EXISTS profile_fields_field_type_check;
ALTER TABLE public.profile_fields
  ADD CONSTRAINT profile_fields_field_type_check
  CHECK (field_type IN ('text', 'textarea', 'date', 'number', 'url', 'multi_row', 'select'));

ALTER TABLE public.profile_fields
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Convert the existing "Civil Status" custom field to a dropdown.
UPDATE public.profile_fields
SET field_type = 'select',
    options = '["Single","Married","Divorced","Widowed"]'::jsonb
WHERE id = 'b4ac6bf6-2779-45e3-b944-942fff02bd37';
