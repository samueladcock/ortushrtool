-- Rename built-in profile field labels and section names for clarity.
-- built_in_key values stay the same (they map to columns on the users
-- table and are used by code); only user-facing display strings change.

UPDATE public.profile_fields
SET label = 'Given Name(s)'
WHERE built_in_key = 'first_name';

UPDATE public.profile_fields
SET label = 'Working Location'
WHERE built_in_key = 'location';

UPDATE public.profile_field_sections
SET name = 'Recruitment Information'
WHERE built_in_key = 'references';
