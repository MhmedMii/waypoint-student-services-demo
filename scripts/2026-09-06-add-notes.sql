-- 2026-09-06 — ملاحظة اختيارية على الزيارة + ملاحظة داخلية على حساب المستشار
--
-- إضافتين مستقلتين، بدون أي تأثير على البيانات الموجودة (كلها NULL افتراضياً):
--
-- 1) counselor_note على visits: يقدر المستشار يكتبها اختيارياً وقت "Finish & Next"
--    (لا تغيّر سلوك الإنهاء الحالي، فقط تضيف نص حر يظهر بصفحة My Students وصفحة
--    Visits & Applications).
-- 2) note على users: ملاحظة داخلية يكتبها admin/super_admin عن حساب مستشار
--    (تظهر وتتعدّل من صفحة Accounts، جنب تعديل الـshift والـscopes).
--
--   psql "$DATABASE_URL" -f scripts/2026-09-06-add-notes.sql

BEGIN;

ALTER TABLE visits ADD COLUMN IF NOT EXISTS counselor_note TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS note TEXT;

COMMIT;

-- للتأكد بعد التشغيل:
--   \d visits
--   \d users
-- المفروض العمودين يطلعوا nullable وفاضيين (NULL) لكل الصفوف القديمة.
