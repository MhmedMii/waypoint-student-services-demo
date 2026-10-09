import { pool } from '../db/pool'

// كان هذا بذاكرة السيرفر، والذاكرة على Vercel تروح مع كل نسخة تنطفي — يعني
// الحد الأقصى ما يصمد فعليًا بالإنتاج (serverless cold start يصفّره). نفس
// درس login/submission rate limiters — نخزّنه بقاعدة البيانات زيهم بالضبط.
// نعدّ كل طلب (مو بس الفاشل) عشان يمنع أحد يفجّر بريد ضحية بإيميلات إعادة تعيين
const MAX_REQUESTS = 5
const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 15 * 60 * 1000

const keyFor = (email: string) => `forgotpw:${email.trim().toLowerCase()}`

export async function isForgotPasswordRateLimited(email: string, now: number): Promise<boolean> {
  const result = await pool.query(
    'SELECT blocked_until FROM rate_limit_lockouts WHERE lockout_key = $1',
    [keyFor(email)]
  )
  const blockedUntil = result.rows[0]?.blocked_until
  if (!blockedUntil) return false
  return new Date(blockedUntil).getTime() > now
}

export async function recordForgotPasswordRequest(email: string, now: number): Promise<void> {
  const key = keyFor(email)
  const existing = await pool.query(
    'SELECT failure_count, updated_at FROM rate_limit_lockouts WHERE lockout_key = $1',
    [key]
  )
  const row = existing.rows[0]

  // النافذة تبدأ من جديد إذا مرّت 15 دقيقة بدون أي طلب لنفس الإيميل. الحظر
  // يفعّل بمجرد ما العداد يوصل الحد (>=) لا لما يتخطاه — عشان الطلب اللي
  // يوصّل العداد بالضبط للحد يكون هو آخر واحد يعدّي قبل الحظر
  const windowExpired = !row || now - new Date(row.updated_at).getTime() > WINDOW_MS
  const countInWindow = windowExpired ? 1 : row.failure_count + 1
  const blockedUntil = countInWindow >= MAX_REQUESTS ? new Date(now + BLOCK_MS) : null

  await pool.query(
    `INSERT INTO rate_limit_lockouts (lockout_key, failure_count, blocked_until, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lockout_key)
     DO UPDATE SET failure_count = $2, blocked_until = $3, updated_at = $4`,
    [key, countInWindow, blockedUntil, new Date(now)]
  )
}
