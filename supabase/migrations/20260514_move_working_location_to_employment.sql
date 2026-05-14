-- Move the built-in "Working Location" field from the Personal section
-- to the Employment section. It belongs alongside Department, Job Title,
-- and Direct Manager since it describes where someone works, not a
-- personal attribute. Place it right after Direct Manager.
UPDATE public.profile_fields
SET section_id = (
      SELECT id FROM public.profile_field_sections WHERE built_in_key = 'employment'
    ),
    sort_order = 85
WHERE built_in_key = 'location';
