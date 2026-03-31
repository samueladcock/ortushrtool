-- Enums
CREATE TYPE user_role AS ENUM ('employee', 'manager', 'hr_admin', 'super_admin');
CREATE TYPE adjustment_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE attendance_status AS ENUM ('on_time', 'late_arrival', 'early_departure', 'late_and_early', 'absent', 'rest_day');
CREATE TYPE flag_type AS ENUM ('late_arrival', 'early_departure', 'absent');
CREATE TYPE notification_type AS ENUM ('schedule_adjustment_request', 'schedule_adjustment_decision', 'attendance_flag');
CREATE TYPE notification_status AS ENUM ('sent', 'failed');

-- Users table (extends auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'employee',
  manager_id UUID REFERENCES public.users(id),
  department TEXT,
  desktime_employee_id INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_manager ON public.users(manager_id);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_desktime ON public.users(desktime_employee_id);

-- Schedules table
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  is_rest_day BOOLEAN NOT NULL DEFAULT false,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, day_of_week, effective_from)
);

CREATE INDEX idx_schedules_employee ON public.schedules(employee_id);

-- Schedule adjustments
CREATE TABLE public.schedule_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_date DATE NOT NULL,
  original_start_time TIME NOT NULL,
  original_end_time TIME NOT NULL,
  requested_start_time TIME NOT NULL,
  requested_end_time TIME NOT NULL,
  reason TEXT NOT NULL,
  status adjustment_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adjustments_employee ON public.schedule_adjustments(employee_id);
CREATE INDEX idx_adjustments_status ON public.schedule_adjustments(status);
CREATE INDEX idx_adjustments_date ON public.schedule_adjustments(requested_date);

-- Attendance logs
CREATE TABLE public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  desktime_employee_id INTEGER,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  scheduled_start TIME NOT NULL,
  scheduled_end TIME NOT NULL,
  status attendance_status NOT NULL DEFAULT 'on_time',
  late_minutes INTEGER,
  early_departure_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_response JSONB,
  UNIQUE(employee_id, date)
);

CREATE INDEX idx_attendance_employee ON public.attendance_logs(employee_id);
CREATE INDEX idx_attendance_date ON public.attendance_logs(date);

-- Attendance flags
CREATE TABLE public.attendance_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id UUID REFERENCES public.attendance_logs(id),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  flag_type flag_type NOT NULL,
  flag_date DATE NOT NULL,
  deviation_minutes INTEGER NOT NULL DEFAULT 0,
  scheduled_time TIME NOT NULL,
  actual_time TIME,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flags_employee ON public.attendance_flags(employee_id);
CREATE INDEX idx_flags_date ON public.attendance_flags(flag_date);
CREATE INDEX idx_flags_type ON public.attendance_flags(flag_type);

-- System settings
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default settings
INSERT INTO public.system_settings (key, value) VALUES
  ('late_tolerance_minutes', '15'),
  ('early_tolerance_minutes', '15');

-- Notification log
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  related_id UUID,
  status notification_status NOT NULL DEFAULT 'sent'
);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Helper function for RLS
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_manager_id()
RETURNS UUID AS $$
  SELECT manager_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- ============ USERS ============

-- Everyone can read their own profile
CREATE POLICY users_read_own ON public.users
  FOR SELECT USING (id = auth.uid());

-- Managers can read their direct reports
CREATE POLICY users_read_reports ON public.users
  FOR SELECT USING (manager_id = auth.uid());

-- HR Admin and Super Admin can read all users
CREATE POLICY users_read_all ON public.users
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- HR Admin can update user details (except role)
CREATE POLICY users_update_hr ON public.users
  FOR UPDATE USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- Users can update their own profile (limited fields handled at app level)
CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (id = auth.uid());

-- ============ SCHEDULES ============

CREATE POLICY schedules_read_own ON public.schedules
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY schedules_read_reports ON public.schedules
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
  );

CREATE POLICY schedules_read_all ON public.schedules
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

CREATE POLICY schedules_write_hr ON public.schedules
  FOR ALL USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- ============ SCHEDULE ADJUSTMENTS ============

CREATE POLICY adjustments_read_own ON public.schedule_adjustments
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY adjustments_create_own ON public.schedule_adjustments
  FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY adjustments_read_reports ON public.schedule_adjustments
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
  );

CREATE POLICY adjustments_update_manager ON public.schedule_adjustments
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
  );

CREATE POLICY adjustments_read_all ON public.schedule_adjustments
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- ============ ATTENDANCE LOGS ============

CREATE POLICY attendance_read_own ON public.attendance_logs
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY attendance_read_reports ON public.attendance_logs
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
  );

CREATE POLICY attendance_read_all ON public.attendance_logs
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- Insert only via service role (cron jobs)

-- ============ ATTENDANCE FLAGS ============

CREATE POLICY flags_read_own ON public.attendance_flags
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY flags_update_own ON public.attendance_flags
  FOR UPDATE USING (employee_id = auth.uid());

CREATE POLICY flags_read_reports ON public.attendance_flags
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
  );

CREATE POLICY flags_read_all ON public.attendance_flags
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

CREATE POLICY flags_update_hr ON public.attendance_flags
  FOR UPDATE USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- ============ SYSTEM SETTINGS ============

CREATE POLICY settings_read_all ON public.system_settings
  FOR SELECT USING (true);

CREATE POLICY settings_write_admin ON public.system_settings
  FOR ALL USING (
    public.get_user_role() = 'super_admin'
  );

-- ============ NOTIFICATION LOG ============

CREATE POLICY notifications_read_all ON public.notification_log
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );
-- Add work location to schedules
CREATE TYPE work_location AS ENUM ('office', 'online');

ALTER TABLE public.schedules
  ADD COLUMN work_location work_location NOT NULL DEFAULT 'office';

-- Add timezone to users (not everyone is PHT)
ALTER TABLE public.users
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Manila';
-- Leave request types
CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'personal', 'unpaid', 'other');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

-- Leave requests table
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status leave_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leave_employee ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_status ON public.leave_requests(status);
CREATE INDEX idx_leave_dates ON public.leave_requests(start_date, end_date);

-- RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY leave_read_own ON public.leave_requests
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY leave_create_own ON public.leave_requests
  FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY leave_read_reports ON public.leave_requests
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
  );

CREATE POLICY leave_update_manager ON public.leave_requests
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
  );

CREATE POLICY leave_read_all ON public.leave_requests
  FOR SELECT USING (
    public.get_user_role() IN ('hr_admin', 'super_admin')
  );
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
