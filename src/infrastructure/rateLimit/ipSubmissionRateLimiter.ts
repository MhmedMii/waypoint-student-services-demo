import { pool } from '../db/pool'

// حظر التقديم مختلف تمامًا عن حظر تسجيل الدخول: الدخول يعدّ المحاولات الفاشلة
// (نادرة)، أما هنا فنعدّ التقديمات الناجحة. كشك الاستقبال كله يطلع من IP واحد،
// فحد "٣ محاولات" اللي يناسب الدخول كان بيقفل الكشك على رابع زائر باليوم.
// بدل كذا: نافذة زمنية — كم تقديم خلال آخر ١٠ دقايق من نفس الجهاز.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 20
// الرسالة العامة تذكر هالمدة بالدقائق (errors.tooManySubmissions) — اختبار يربطهما
export const BLOCK_MS = 10 * 60 * 1000

const keyFor = (ip: string) => `submit:${ip}`

export async function isIpSubmissionRateLimited(ip: string, now: number): Promise<boolean> {
  const result = await pool.query(
    'SELECT blocked_until FROM rate_limit_lockouts WHERE lockout_key = $1',
    [keyFor(ip)]
  )
  const blockedUntil = result.rows[0]?.blocked_until
  if (!blockedUntil) return false
  return new Date(blockedUntil).getTime() > now
}

export async function recordSubmissionAttempt(ip: string, now: number): Promise<void> {
  const key = keyFor(ip)
  const existing = await pool.query(
    'SELECT failure_count, updated_at FROM rate_limit_lockouts WHERE lockout_key = $1',
    [key]
  )
  const row = existing.rows[0]

  // النافذة تبدأ من جديد إذا مرّت ١٠ دقايق بدون أي تقديم من هالجهاز
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

export async function clearSubmissionAttempts(ip: string): Promise<void> {
  await pool.query('DELETE FROM rate_limit_lockouts WHERE lockout_key = $1', [keyFor(ip)])
}
