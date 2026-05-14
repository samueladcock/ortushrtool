-- Rename the built-in "Manager" profile field label to "Direct Manager"
-- so it isn't confused with "is a manager?" (the user role).
UPDATE public.profile_fields
SET label = 'Direct Manager'
WHERE built_in_key = 'manager_id';
