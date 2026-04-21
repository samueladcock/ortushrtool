-- Email templates table for admin-editable email content
CREATE TABLE public.email_templates (
  type TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Everyone can read templates (needed by API routes)
CREATE POLICY email_templates_read ON public.email_templates
  FOR SELECT USING (true);

-- Only super_admin can write
CREATE POLICY email_templates_write ON public.email_templates
  FOR ALL USING (public.get_user_role() = 'super_admin');

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
