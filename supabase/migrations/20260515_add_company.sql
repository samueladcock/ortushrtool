-- Add a built-in "Company" field. Each employee belongs to one of four
-- entities; values are constrained so typos don't proliferate. The
-- profile-field row maps to users.company via built_in_key = 'company'.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company TEXT
    CHECK (
      company IS NULL OR company IN (
        'Ortus Strategy Pte. Ltd.',
        'm-Club Coaching LTD.',
        'Trinity Outsourcing Solutions Inc.',
        'APEX Strategy'
      )
    );

-- Surface it under Employment, right after Department.
INSERT INTO public.profile_fields (section_id, label, field_type, visibility, sort_order, built_in_key)
SELECT s.id, 'Company', 'text', 'everyone', 15, 'company'
FROM public.profile_field_sections s
WHERE s.built_in_key = 'employment'
ON CONFLICT (built_in_key) DO NOTHING;
