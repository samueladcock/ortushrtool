-- Rename the built-in "Role" profile field label to "Access Level" so
-- it isn't confused with "Job Title". built_in_key 'role' stays — it
-- maps to the users.role enum (employee/manager/hr_admin/hr_support/
-- super_admin).
UPDATE public.profile_fields
SET label = 'Access Level'
WHERE built_in_key = 'role';
