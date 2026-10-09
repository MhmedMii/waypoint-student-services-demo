-- src/infrastructure/db/schema.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'counselor')),
  email TEXT NOT NULL UNIQUE CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  online_seconds_today INTEGER NOT NULL DEFAULT 0,
  online_day TEXT,
  shift TEXT CHECK (shift IN ('day', 'night')),
  floor TEXT CHECK (floor IN ('M1', 'M3')),
  note TEXT
);

-- حد أقصى 2 سوبر أدمن مسموح بهم بالنظام — الحد نفسه يتطبق بمستوى الكود (promoteToSuperAdmin.ts, addAccount.ts)

CREATE TABLE counselor_specialization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES users(id),
  scope TEXT NOT NULL CHECK (scope IN ('Medicine', 'USA', 'UK & Ireland', 'Australia & New Zealand', 'Europe & Other Countries', 'GCC', 'Egypt', 'visa_services', 'exam_services')),
  last_assigned_at TIMESTAMPTZ
);

CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('new', 'follow_up', 'visa')),
  name TEXT NOT NULL,
  -- AES-256-GCM ciphertext of the client's phone number, plus an HMAC blind index for
  -- exact-match lookups (WHERE phone_search_hash = ...) — see src/infrastructure/crypto/fieldEncryption.ts.
  -- Replaces a plaintext `phone` column.
  phone_encrypted TEXT NOT NULL,
  phone_search_hash TEXT NOT NULL,
  desired_country TEXT,
  counselor_id UUID REFERENCES users(id),
  -- The counselor the client asked for at the kiosk (follow-up visits). Stays
  -- the same if a supervisor reassigns, so "came to" and "assigned to" can differ.
  -- Backfilled 24 Sep 2026 for follow-ups never reassigned; the one that was is NULL.
  requested_counselor_id UUID REFERENCES users(id),
  -- When the current counselor was assigned (automatically or by hand). NULL = unassigned.
  -- Backfilled 24 Sep 2026 from the last visit_reassigned log, else created_at, so
  -- older values are approximate where a reassignment predates the activity log.
  assigned_at TIMESTAMPTZ,
  linked_visit_id UUID REFERENCES visits(id),
  status TEXT NOT NULL DEFAULT 'next' CHECK (status IN ('next', 'closed')),
  student_status TEXT DEFAULT 'waiting' CHECK (student_status IN ('waiting', 'in_session', 'follow_up_needed', 'closed')),
  picked_up_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  counselor_note TEXT,
  follow_up_due_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The two statuses must agree: an open visit is Waiting or In session, a closed
  -- visit is Closed or Follow-up needed. Two real visits once ended up Closed + In session.
  CONSTRAINT visits_status_pair_check CHECK (
    student_status IS NULL
    OR (status = 'next' AND student_status IN ('waiting', 'in_session'))
    OR (status = 'closed' AND student_status IN ('closed', 'follow_up_needed'))
  ),
  -- "Finished" is one fact, not three. A visit used to be finishable as "waiting",
  -- which stamped closed_at while leaving status open: the same visit then counted
  -- as served today, showed as open in the funnel, and sat in turnaround as
  -- "in progress" with the hours growing for ever.
  CONSTRAINT visits_closed_at_matches_status_check CHECK (
    (status = 'closed') = (closed_at IS NOT NULL)
  )
);

CREATE INDEX visits_phone_search_hash_idx ON visits (phone_search_hash);
CREATE INDEX visits_counselor_idx ON visits (counselor_id);
CREATE INDEX visits_created_at_idx ON visits (created_at DESC);

CREATE TABLE breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX breaks_counselor_started_idx ON breaks (counselor_id, started_at);

-- استراحة مفتوحة وحدة لكل مستشار. الشرط الجزئي يخلي القاعدة ترفض الصف الثاني
-- بدل ما نعتمد على الكود وحده — نفس فكرة visits_closed_at_matches_status_check
CREATE UNIQUE INDEX breaks_one_open_per_counselor ON breaks (counselor_id) WHERE ended_at IS NULL;

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable: الزيارة تنفتح من كشك الاستقبال والطلب ينرسل من فورم عام — بدون جلسة،
  -- فما فيه user نربط فيه. هالصفوف تنكتب بـ actor_role = 'system'.
  actor_id UUID REFERENCES users(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('super_admin', 'admin', 'counselor', 'system')),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('account', 'visit', 'application')),
  target_id TEXT NOT NULL,
  details TEXT,
  -- بديل details بالعربي — يبقى NULL على الصفوف القديمة المسجّلة قبل هذا العمود،
  -- فتظل تُعرض بالإنجليزي فقط وقت اللغة عربي (تدهور تلقائي مقبول، لا نعيد كتابة التاريخ)
  details_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX activity_logs_created_at_idx ON activity_logs (created_at DESC);

CREATE TABLE online_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX online_sessions_user_started_idx ON online_sessions (user_id, started_at DESC);

-- ترقيم تسلسلي منفصل لكل نوع (فيزا/اختبار) — يولّد رقم طلب مقروء زي VISA-0001، آمن من التعارض عند التزامن
CREATE SEQUENCE visa_application_number_seq START 1;
CREATE SEQUENCE exam_application_number_seq START 1;

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('visa', 'exam')),
  service_code TEXT NOT NULL,
  name TEXT NOT NULL,
  -- See the matching comment on visits above and src/infrastructure/crypto/fieldEncryption.ts.
  -- fields_encrypted holds AES-256-GCM ciphertext of JSON.stringify(fields) as one blob per row —
  -- nothing queries into individual keys, so no per-key encryption is needed. Replaces plaintext
  -- `phone` and `fields` columns.
  phone_encrypted TEXT NOT NULL,
  phone_search_hash TEXT NOT NULL,
  fields_encrypted TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','under_review','documents_requested','submitted_to_source','approved','rejected')),
  status_note TEXT,
  reference_number TEXT,
  counselor_id UUID REFERENCES users(id),
  payment_url TEXT,
  accepted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX applications_kind_idx ON applications (kind);
CREATE INDEX applications_status_idx ON applications (status);
CREATE INDEX applications_phone_search_hash_idx ON applications (phone_search_hash);

CREATE TABLE application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  blob_pathname TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  document_label TEXT,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX application_documents_application_idx ON application_documents (application_id);

-- حظر محاولات الدخول الفاشلة. كان بذاكرة السيرفر، والذاكرة على Vercel تروح مع
-- كل نسخة تنطفي — يعني العداد يترجع صفر لحاله والحظر ما يصمد. هنا يصير بقاعدة
-- البيانات عشان يعيش عبر النسخ والنشرات.
CREATE TABLE rate_limit_lockouts (
  lockout_key TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- للتنظيف الدوري للصفوف القديمة عشان الجدول ما يكبر بلا نهاية
CREATE INDEX rate_limit_lockouts_updated_at_idx ON rate_limit_lockouts (updated_at);
