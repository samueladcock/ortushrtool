-- Per-country, per-year anniversary benefit content shown in the
-- work_anniversary email. One row per (country, years); empty when no
-- benefit is defined for that milestone.
CREATE TABLE IF NOT EXISTS public.anniversary_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  years INT NOT NULL CHECK (years >= 1),
  body TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country, years)
);

ALTER TABLE public.anniversary_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anniversary_benefits_read ON public.anniversary_benefits;
CREATE POLICY anniversary_benefits_read ON public.anniversary_benefits
  FOR SELECT USING (true);

DROP POLICY IF EXISTS anniversary_benefits_write ON public.anniversary_benefits;
CREATE POLICY anniversary_benefits_write ON public.anniversary_benefits
  FOR ALL USING (public.get_user_role() = 'super_admin');
