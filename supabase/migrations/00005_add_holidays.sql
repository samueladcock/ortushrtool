-- Holiday country enum
CREATE TYPE holiday_country AS ENUM ('PH', 'XK', 'IT', 'AE');

-- Holidays table
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country holiday_country NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country, date, name)
);

CREATE INDEX idx_holidays_country ON public.holidays(country);
CREATE INDEX idx_holidays_date ON public.holidays(date);

CREATE TRIGGER update_holidays_updated_at
  BEFORE UPDATE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read holidays
CREATE POLICY holidays_read_all ON public.holidays
  FOR SELECT USING (true);

-- Only hr_admin and super_admin can manage holidays
CREATE POLICY holidays_insert_admin ON public.holidays
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

CREATE POLICY holidays_update_admin ON public.holidays
  FOR UPDATE USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

CREATE POLICY holidays_delete_admin ON public.holidays
  FOR DELETE USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- Add holiday_country to users so each employee is tied to a holiday calendar
ALTER TABLE public.users
  ADD COLUMN holiday_country holiday_country NOT NULL DEFAULT 'PH';

-- Seed holidays for 2025 and 2026

-- Philippines (PH)
INSERT INTO public.holidays (country, name, date, is_recurring) VALUES
  -- 2025
  ('PH', 'New Year''s Day', '2025-01-01', true),
  ('PH', 'Araw ng Kagitingan', '2025-04-09', true),
  ('PH', 'Maundy Thursday', '2025-04-17', false),
  ('PH', 'Good Friday', '2025-04-18', false),
  ('PH', 'Black Saturday', '2025-04-19', false),
  ('PH', 'Labor Day', '2025-05-01', true),
  ('PH', 'Independence Day', '2025-06-12', true),
  ('PH', 'National Heroes Day', '2025-08-25', false),
  ('PH', 'Bonifacio Day', '2025-11-30', true),
  ('PH', 'Christmas Eve', '2025-12-24', true),
  ('PH', 'Christmas Day', '2025-12-25', true),
  ('PH', 'Rizal Day', '2025-12-30', true),
  ('PH', 'New Year''s Eve', '2025-12-31', true),
  -- 2026
  ('PH', 'New Year''s Day', '2026-01-01', true),
  ('PH', 'Araw ng Kagitingan', '2026-04-09', true),
  ('PH', 'Maundy Thursday', '2026-04-02', false),
  ('PH', 'Good Friday', '2026-04-03', false),
  ('PH', 'Black Saturday', '2026-04-04', false),
  ('PH', 'Labor Day', '2026-05-01', true),
  ('PH', 'Independence Day', '2026-06-12', true),
  ('PH', 'National Heroes Day', '2026-08-31', false),
  ('PH', 'Bonifacio Day', '2026-11-30', true),
  ('PH', 'Christmas Eve', '2026-12-24', true),
  ('PH', 'Christmas Day', '2026-12-25', true),
  ('PH', 'Rizal Day', '2026-12-30', true),
  ('PH', 'New Year''s Eve', '2026-12-31', true),

-- Kosovo (XK)
  -- 2025
  ('XK', 'New Year''s Day', '2025-01-01', true),
  ('XK', 'Independence Day', '2025-02-17', true),
  ('XK', 'Constitution Day', '2025-04-09', true),
  ('XK', 'Labor Day', '2025-05-01', true),
  ('XK', 'Europe Day', '2025-05-09', true),
  ('XK', 'Liberation Day', '2025-06-12', true),
  ('XK', 'Catholic Easter', '2025-04-20', false),
  ('XK', 'Orthodox Easter', '2025-04-20', false),
  ('XK', 'Christmas Day', '2025-12-25', true),
  -- 2026
  ('XK', 'New Year''s Day', '2026-01-01', true),
  ('XK', 'Independence Day', '2026-02-17', true),
  ('XK', 'Constitution Day', '2026-04-09', true),
  ('XK', 'Labor Day', '2026-05-01', true),
  ('XK', 'Europe Day', '2026-05-09', true),
  ('XK', 'Liberation Day', '2026-06-12', true),
  ('XK', 'Catholic Easter', '2026-04-05', false),
  ('XK', 'Orthodox Easter', '2026-04-12', false),
  ('XK', 'Christmas Day', '2026-12-25', true),

-- Italy (IT)
  -- 2025
  ('IT', 'New Year''s Day', '2025-01-01', true),
  ('IT', 'Epiphany', '2025-01-06', true),
  ('IT', 'Easter Monday', '2025-04-21', false),
  ('IT', 'Liberation Day', '2025-04-25', true),
  ('IT', 'Labor Day', '2025-05-01', true),
  ('IT', 'Republic Day', '2025-06-02', true),
  ('IT', 'Ferragosto', '2025-08-15', true),
  ('IT', 'All Saints'' Day', '2025-11-01', true),
  ('IT', 'Immaculate Conception', '2025-12-08', true),
  ('IT', 'Christmas Day', '2025-12-25', true),
  ('IT', 'St. Stephen''s Day', '2025-12-26', true),
  -- 2026
  ('IT', 'New Year''s Day', '2026-01-01', true),
  ('IT', 'Epiphany', '2026-01-06', true),
  ('IT', 'Easter Monday', '2026-04-06', false),
  ('IT', 'Liberation Day', '2026-04-25', true),
  ('IT', 'Labor Day', '2026-05-01', true),
  ('IT', 'Republic Day', '2026-06-02', true),
  ('IT', 'Ferragosto', '2026-08-15', true),
  ('IT', 'All Saints'' Day', '2026-11-01', true),
  ('IT', 'Immaculate Conception', '2026-12-08', true),
  ('IT', 'Christmas Day', '2026-12-25', true),
  ('IT', 'St. Stephen''s Day', '2026-12-26', true),

-- UAE / Dubai (AE)
  -- 2025
  ('AE', 'New Year''s Day', '2025-01-01', true),
  ('AE', 'Eid al-Fitr', '2025-03-30', false),
  ('AE', 'Eid al-Fitr Holiday', '2025-03-31', false),
  ('AE', 'Eid al-Fitr Holiday', '2025-04-01', false),
  ('AE', 'Arafat Day', '2025-06-05', false),
  ('AE', 'Eid al-Adha', '2025-06-06', false),
  ('AE', 'Eid al-Adha Holiday', '2025-06-07', false),
  ('AE', 'Eid al-Adha Holiday', '2025-06-08', false),
  ('AE', 'Islamic New Year', '2025-06-26', false),
  ('AE', 'Prophet Muhammad''s Birthday', '2025-09-04', false),
  ('AE', 'Commemoration Day', '2025-11-30', true),
  ('AE', 'National Day', '2025-12-02', true),
  ('AE', 'National Day Holiday', '2025-12-03', true),
  -- 2026
  ('AE', 'New Year''s Day', '2026-01-01', true),
  ('AE', 'Eid al-Fitr', '2026-03-20', false),
  ('AE', 'Eid al-Fitr Holiday', '2026-03-21', false),
  ('AE', 'Eid al-Fitr Holiday', '2026-03-22', false),
  ('AE', 'Arafat Day', '2026-05-26', false),
  ('AE', 'Eid al-Adha', '2026-05-27', false),
  ('AE', 'Eid al-Adha Holiday', '2026-05-28', false),
  ('AE', 'Eid al-Adha Holiday', '2026-05-29', false),
  ('AE', 'Islamic New Year', '2026-06-16', false),
  ('AE', 'Prophet Muhammad''s Birthday', '2026-08-25', false),
  ('AE', 'Commemoration Day', '2026-11-30', true),
  ('AE', 'National Day', '2026-12-02', true),
  ('AE', 'National Day Holiday', '2026-12-03', true);
