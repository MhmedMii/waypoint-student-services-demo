import { pool } from '../db/pool'
import { createSearchableFingerprint } from '../crypto/fieldEncryption'

// يمنع نفس الشخص من إرسال الفورم مرة بعد مرة. ثلاث مرات مسموحة خلال ربع ساعة
// (تكفي لو غلط بالاسم وأعاد الإرسال)، والرابعة تنحظر.
//
// نعدّ حسب رقم الجوال مو الـ IP: العملاء يجون من بيانات جوالاتهم فكل واحد له IP
// مختلف، والـ IP ما يميّز الشخص أصلاً. ونخزّن بصمة الرقم (HMAC) مو الرقم نفسه —
// الأرقام مشفّرة بقاعدة البيانات، فما يصير نسرّبها بجدول الحظر.
const WINDOW_MS = 15 * 60 * 1000
const MAX_PER_WINDOW = 3
// الرسالة العامة تذكر هالمدة بالدقائق (errors.tooManySubmissionsFromNumber) — اختبار يربطهما
export const BLOCK_MS = 15 * 60 * 1000

const keyFor = (phone: string) => `submitphone:${createSearchableFingerprint(phone.trim())}`

export async function isRepeatSubmitterBlocked(phone: string, now: number): Promise<boolean> {
  const result = await pool.query(
    'SELECT blocked_until FROM rate_limit_lockouts WHERE lockout_key = $1',
    [keyFor(phone)]
  )
  const blockedUntil = result.rows[0]?.blocked_until
  if (!blockedUntil) return false
  return new Date(blockedUntil).getTime() > now
}

export async function recordPhoneSubmission(phone: string, now: number): Promise<void> {
  const key = keyFor(phone)
  const existing = await pool.query(
    'SELECT failure_count, updated_at FROM rate_limit_lockouts WHERE lockout_key = $1',
    [key]
  )
  const row = existing.rows[0]

  const windowExpired = !row || now - new Date(row.updated_at).getTime() > WINDOW_MS
  const countInWindow = windowExpired ? 1 : row.failure_count + 1
  // >= لا >: الحارس يفحص ثم يسجّل، فالطلب اللي يوصّل العداد للحد لازم يكون
  // هو اللي يقفل الباب. بـ> كان الحد الفعلي أكبر بواحد من المكتوب — "٣ لكل
  // رقم" تقبل ٤، و"٢٠ لكل جهاز" تقبل ٢١. نفس دلالة forgotPasswordRateLimiter
  const blockedUntil = countInWindow >= MAX_PER_WINDOW ? new Date(now + BLOCK_MS) : null

  await pool.query(
    `INSERT INTO rate_limit_lockouts (lockout_key, failure_count, blocked_until, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lockout_key)
     DO UPDATE SET failure_count = $2, blocked_until = $3, updated_at = $4`,
    [key, countInWindow, blockedUntil, new Date(now)]
  )
}

export async function clearPhoneSubmissions(phone: string): Promise<void> {
  await pool.query('DELETE FROM rate_limit_lockouts WHERE lockout_key = $1', [keyFor(phone)])
}
