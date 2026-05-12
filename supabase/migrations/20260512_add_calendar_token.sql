-- Per-user secret used to authenticate iCal subscription feed requests.
-- Null until the user opts in by generating one from /settings/calendar.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS calendar_token UUID;

CREATE INDEX IF NOT EXISTS idx_users_calendar_token
  ON public.users(calendar_token)
  WHERE calendar_token IS NOT NULL;
