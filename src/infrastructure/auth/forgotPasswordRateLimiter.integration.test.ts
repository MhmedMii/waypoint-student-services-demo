// src/infrastructure/auth/forgotPasswordRateLimiter.integration.test.ts
import { it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import {
  isForgotPasswordRateLimited,
  recordForgotPasswordRequest,
} from './forgotPasswordRateLimiter'

const runIntegration = integrationDescribe

const MINUTE = 60 * 1000

runIntegration('forgotPasswordRateLimiter (integration)', () => {
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

  it('is not rate-limited before any requests', async () => {
    expect(await isForgotPasswordRateLimited('fresh.email@example.com', Date.now())).toBe(false)
  })

  it('rate-limits after 5 requests within the window', async () => {
    const now = Date.now()
    const email = 'staff.member@example.com'
    for (let i = 0; i < 5; i++) await recordForgotPasswordRequest(email, now + i * 100)
    expect(await isForgotPasswordRateLimited(email, now)).toBe(true)
  })

  it('does not rate-limit a different email', async () => {
    const now = Date.now()
    const email = 'busy.mailbox@example.com'
    for (let i = 0; i < 5; i++) await recordForgotPasswordRequest(email, now + i * 100)
    expect(await isForgotPasswordRateLimited('other.mailbox@example.com', now)).toBe(false)
  })

  it('resets the count once the window has passed', async () => {
    const now = Date.now()
    const email = 'later.window@example.com'
    for (let i = 0; i < 5; i++) await recordForgotPasswordRequest(email, now + i * 100)
    const afterWindow = now + 16 * MINUTE
    expect(await isForgotPasswordRateLimited(email, afterWindow)).toBe(false)
  })

  // هذا بالذات هو الخلل اللي صلّحناه: نفس المفتاح لازم يصمد عبر أكثر من
  // Pool منفصل — يحاكي طلبين وصلوا لنسختين مختلفتين من الدالة السحابية
  it('persists the lockout across separate connections, unlike the old in-memory version', async () => {
    const now = Date.now()
    const email = 'cold.start@example.com'
    for (let i = 0; i < 5; i++) await recordForgotPasswordRequest(email, now + i * 100)

    const freshPool = new Pool({ connectionString: process.env.DATABASE_URL })
    try {
      const stillLimited = await (async () => {
        const result = await freshPool.query(
          'SELECT blocked_until FROM rate_limit_lockouts WHERE lockout_key = $1',
          [`forgotpw:${email}`]
        )
        return Boolean(result.rows[0]?.blocked_until)
      })()
      expect(stillLimited).toBe(true)
    } finally {
      await freshPool.end()
    }
  })
})
