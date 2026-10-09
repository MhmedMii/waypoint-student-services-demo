import { pool } from '../db/pool'

// مسار إعادة التعيين كان بلا أي حد، بينما جاره forgot-password عنده حد. وكل
// نداء يوصل claimToken: تحديث على password_reset_tokens بدون تسجيل دخول، على
// نفس الـ Pool اللي يستخدمه تسجيل الدخول نفسه (عشرة اتصالات فقط). التوكن
// عشوائي فتخمينه غير عملي — لكن خنق الاتصالات ما يحتاج تخمين، يحتاج ضغط بس،
// والضحية يكون تسجيل الدخول لكل الموظفين

// أوسع من خمسة حق forgot-password: اللي يعيد تعيين كلمته بصدق يجرب أكثر من
// مرة لأن كلمته الأولى ما عدّت شروط القوة. عشرة تكفي للصادق وتوقف السيل
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 15 * 60 * 1000

const keyFor = (ip: string) => `resetpw:${ip}`

export async function isResetPasswordRateLimited(ip: string, now: number): Promise<boolean> {
  const result = await pool.query(
    'SELECT blocked_until FROM rate_limit_lockouts WHERE lockout_key = $1',
    [keyFor(ip)]
  )
  const blockedUntil = result.rows[0]?.blocked_until
  if (!blockedUntil) return false
  return new Date(blockedUntil).getTime() > now
}

export async function recordResetPasswordAttempt(ip: string, now: number): Promise<void> {
  const key = keyFor(ip)
  const existing = await pool.query(
    'SELECT failure_count, updated_at FROM rate_limit_lockouts WHERE lockout_key = $1',
    [key]
  )
  const row = existing.rows[0]

  // نفس دلالة الجار بالضبط: النافذة تبدأ من جديد إذا مرّت ١٥ دقيقة بدون أي
  // محاولة، والحظر يفعّل لما العداد يوصل الحد (>=) لا لما يتخطاه
  const windowExpired = !row || now - new Date(row.updated_at).getTime() > WINDOW_MS
  const countInWindow = windowExpired ? 1 : row.failure_count + 1
  const blockedUntil = countInWindow >= MAX_ATTEMPTS ? new Date(now + BLOCK_MS) : null

  await pool.query(
    `INSERT INTO rate_limit_lockouts (lockout_key, failure_count, blocked_until, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lockout_key)
     DO UPDATE SET failure_count = $2, blocked_until = $3, updated_at = $4`,
    [key, countInWindow, blockedUntil, new Date(now)]
  )
}
