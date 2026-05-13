-- Performance feature: review form templates, review cycles, reviews,
-- peer feedback, 1-on-1s, and kudos.

CREATE TABLE IF NOT EXISTS public.review_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  /* Array of { id, text, roles: ["self"|"manager"|"peer"] } */
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.review_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_id UUID REFERENCES public.review_form_templates(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  self_due DATE,
  manager_due DATE,
  peer_due DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.review_cycle_participants (
  cycle_id UUID NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (cycle_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  /* { question_id: { rating: 1-5, comment: text } } */
  self_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  manager_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  self_submitted_at TIMESTAMPTZ,
  manager_submitted_at TIMESTAMPTZ,
  signed_off_at TIMESTAMPTZ,
  manager_reviewer_id UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'self_done', 'manager_done', 'signed_off')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.peer_feedback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id),
  reviewer_id UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'declined')),
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  anonymous BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_peer_feedback_review ON public.peer_feedback_requests(review_id);
CREATE INDEX IF NOT EXISTS idx_peer_feedback_reviewer ON public.peer_feedback_requests(reviewer_id);

CREATE TABLE IF NOT EXISTS public.one_on_ones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  agenda TEXT,
  shared_notes TEXT,
  manager_private_notes TEXT,
  employee_private_notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_one_on_ones_employee ON public.one_on_ones(employee_id);
CREATE INDEX IF NOT EXISTS idx_one_on_ones_manager ON public.one_on_ones(manager_id);

CREATE TABLE IF NOT EXISTS public.kudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kudos_recipient ON public.kudos(recipient_id);

-- ─── RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.review_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_cycle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_feedback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_on_ones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

-- Templates: read by everyone (so the review form can render labels);
-- write by hr_admin+ only.
DROP POLICY IF EXISTS templates_read ON public.review_form_templates;
CREATE POLICY templates_read ON public.review_form_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS templates_write ON public.review_form_templates;
CREATE POLICY templates_write ON public.review_form_templates
  FOR ALL USING (public.get_user_role() IN ('hr_admin', 'super_admin'));

-- Cycles: anyone in the participant list reads; admins manage.
DROP POLICY IF EXISTS cycles_read ON public.review_cycles;
CREATE POLICY cycles_read ON public.review_cycles FOR SELECT USING (true);
DROP POLICY IF EXISTS cycles_write ON public.review_cycles;
CREATE POLICY cycles_write ON public.review_cycles
  FOR ALL USING (public.get_user_role() IN ('hr_admin', 'super_admin'));

DROP POLICY IF EXISTS cycle_participants_read ON public.review_cycle_participants;
CREATE POLICY cycle_participants_read ON public.review_cycle_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS cycle_participants_write ON public.review_cycle_participants;
CREATE POLICY cycle_participants_write ON public.review_cycle_participants
  FOR ALL USING (public.get_user_role() IN ('hr_admin', 'super_admin'));

-- Reviews: visible to self, direct manager, skip-level (mgr's mgr), HR admin+.
DROP POLICY IF EXISTS reviews_read ON public.reviews;
CREATE POLICY reviews_read ON public.reviews
  FOR SELECT USING (
    employee_id = auth.uid()
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.users emp
      WHERE emp.id = reviews.employee_id
        AND emp.manager_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users emp
      JOIN public.users mgr ON mgr.id = emp.manager_id
      WHERE emp.id = reviews.employee_id
        AND mgr.manager_id = auth.uid()
    )
  );
-- Writes go through the API with the admin client.

-- Peer feedback: reviewer reads/writes their own row; HR admin+ sees all.
DROP POLICY IF EXISTS peer_feedback_read ON public.peer_feedback_requests;
CREATE POLICY peer_feedback_read ON public.peer_feedback_requests
  FOR SELECT USING (
    reviewer_id = auth.uid()
    OR requested_by = auth.uid()
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- 1-on-1s: employee, manager, skip-level, HR admin+.
DROP POLICY IF EXISTS one_on_ones_read ON public.one_on_ones;
CREATE POLICY one_on_ones_read ON public.one_on_ones
  FOR SELECT USING (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.users mgr
      WHERE mgr.id = one_on_ones.manager_id
        AND mgr.manager_id = auth.uid()
    )
  );

-- Kudos: public visible to all; private visible to recipient, sender, HR admin+.
DROP POLICY IF EXISTS kudos_read ON public.kudos;
CREATE POLICY kudos_read ON public.kudos
  FOR SELECT USING (
    visibility = 'public'
    OR recipient_id = auth.uid()
    OR sender_id = auth.uid()
    OR public.get_user_role() IN ('hr_admin', 'super_admin')
  );

-- Insert/delete go through the API; deny direct writes from the user client.
