import { it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import { isResetPasswordRateLimited, recordResetPasswordAttempt } from './resetPasswordRateLimiter'

const runIntegration = integrationDescribe

const MINUTE = 60 * 1000

runIntegration('resetPasswordRateLimiter (integration)', () => {
  let pool: Pool

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  })

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM rate_limit_lockouts')
  })

  it('is not rate-limited before any attempt', async () => {
    expect(await isResetPasswordRateLimited('203.0.113.1', Date.now())).toBe(false)
  })

  // تسعة تعدّي: اللي يعيد تعيين كلمته بصدق يجرب أكثر من مرة قبل ما تعدّي شروط القوة
  it('lets nine attempts through', async () => {
    const now = Date.now()
    const ip = '203.0.113.2'
    for (let i = 0; i < 9; i++) await recordResetPasswordAttempt(ip, now + i * 100)
    expect(await isResetPasswordRateLimited(ip, now)).toBe(false)
  })

  it('blocks on the tenth', async () => {
    const now = Date.now()
    const ip = '203.0.113.3'
    for (let i = 0; i < 10; i++) await recordResetPasswordAttempt(ip, now + i * 100)
    expect(await isResetPasswordRateLimited(ip, now)).toBe(true)
  })

  it('does not block a different address', async () => {
    const now = Date.now()
    for (let i = 0; i < 10; i++) await recordResetPasswordAttempt('203.0.113.4', now + i * 100)
    expect(await isResetPasswordRateLimited('203.0.113.5', now)).toBe(false)
  })

  it('starts a fresh window once fifteen minutes have passed', async () => {
    const now = Date.now()
    const ip = '203.0.113.6'
    for (let i = 0; i < 10; i++) await recordResetPasswordAttempt(ip, now + i * 100)
    expect(await isResetPasswordRateLimited(ip, now + 16 * MINUTE)).toBe(false)
  })

  // الحظر بقاعدة البيانات مو بالذاكرة: على Vercel كل طلب ممكن يوصل نسخة
  // جديدة من الدالة، فذاكرة النسخة تروح معها والحد ما يصمد أصلاً
  it('survives a separate connection, as a cold start would be', async () => {
    const now = Date.now()
    const ip = '203.0.113.7'
    for (let i = 0; i < 10; i++) await recordResetPasswordAttempt(ip, now + i * 100)

    const freshPool = new Pool({ connectionString: process.env.DATABASE_URL })
    try {
      const result = await freshPool.query(
        'SELECT blocked_until FROM rate_limit_lockouts WHERE lockout_key = $1',
        [`resetpw:${ip}`]
      )
      expect(Boolean(result.rows[0]?.blocked_until)).toBe(true)
    } finally {
      await freshPool.end()
    }
  })

  // مفتاحان مختلفان: الجار يعدّ بالإيميل، وهذا يعدّ بالـ IP — ما يتداخلون
  it('keeps its own key space, separate from forgot-password', async () => {
    const now = Date.now()
    const ip = '203.0.113.8'
    for (let i = 0; i < 10; i++) await recordResetPasswordAttempt(ip, now + i * 100)

    const rows = await pool.query('SELECT lockout_key FROM rate_limit_lockouts')
    expect(rows.rows.map((r) => r.lockout_key)).toEqual([`resetpw:${ip}`])
  })
})
