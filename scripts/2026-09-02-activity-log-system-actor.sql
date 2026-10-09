-- 2026-09-02 — تسجيل أحداث الكشك والفورم العام
--
-- الزيارات تنفتح من /intake (كشك الباركود) والطلبات من /apply العام — بدون جلسة،
-- فما فيه user نربط فيه actor_id. الكود القديم كان يتخطّى التسجيل كامل بهالحالة،
-- فصار عندنا 117 زيارة بدون ولا صف visit_created بالسجل.
--
-- توسيع فقط — ما فيه شي ينكسر لو انطبق قبل نزول الكود الجديد، والصفوف
-- الموجودة كلها تبقى صالحة. شغّله على production قبل الـdeploy.
--
--   psql "$DATABASE_URL" -f scripts/2026-09-02-activity-log-system-actor.sql

BEGIN;

-- حدث الخدمة الذاتية ما له مستخدم نشير له
ALTER TABLE activity_logs ALTER COLUMN actor_id DROP NOT NULL;

-- نضيف 'system' لقائمة الأدوار المسموحة
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_actor_role_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_actor_role_check
  CHECK (actor_role IN ('super_admin', 'admin', 'counselor', 'system'));

COMMIT;

-- للتأكد بعد التشغيل:
--   \d activity_logs
-- المفروض actor_id يطلع nullable، والقيد يشمل 'system'.
--
-- ملاحظة: هذا يصلّح التسجيل من الآن وطالع بس. الـ117 زيارة القديمة ما لها
-- صفوف نرجّعها — ما انكتبت أصلاً، فما فيه شي نعبّي منه.
