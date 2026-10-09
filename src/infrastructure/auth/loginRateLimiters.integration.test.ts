// src/infrastructure/auth/loginRateLimiters.integration.test.ts
import { it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import { isRateLimited, recordFailedAttempt, clearAttempts } from './loginRateLimiter'
import { isIpRateLimited, recordFailedIpAttempt, clearIpAttempts } from './ipLoginRateLimiter'

// الحظر صار محفوظ بقاعدة البيانات، فهالغلافين ما ينفع نختبرهم بالذاكرة —
// التدرّج نفسه مغطى بـ tieredLockout.test.ts، وهنا نختبر اللي يخص الغلاف:
// إن الإيميل والـ IP ما يتصادمون، وإن حالة الأحرف ما تفرق
const runIntegration = integrationDescribe

runIntegration('login rate limiters (integration)', () => {
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

  it('blocks an email only after the third failure', async () => {
    const now = Date.now()
    await recordFailedAttempt('sarah.k@example.com', now)
    await recordFailedAttempt('sarah.k@example.com', now)
    expect(await isRateLimited('sarah.k@example.com', now)).toBe(false)

    await recordFailedAttempt('sarah.k@example.com', now)
    expect(await isRateLimited('sarah.k@example.com', now)).toBe(true)
  })

  it('treats the same email as one account whatever the letter case', async () => {
    const now = Date.now()
    for (let i = 0; i < 3; i++) await recordFailedAttempt('Sarah.K@Example.com', now)
    expect(await isRateLimited('sarah.k@example.com', now)).toBe(true)
  })

  it('leaves a different email alone', async () => {
    const now = Date.now()
    for (let i = 0; i < 8; i++) await recordFailedAttempt('sarah.k@example.com', now)
    expect(await isRateLimited('omar.f@example.com', now)).toBe(false)
  })

  it('releases an email as soon as it signs in successfully', async () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) await recordFailedAttempt('sarah.k@example.com', now)
    expect(await isRateLimited('sarah.k@example.com', now)).toBe(true)

    await clearAttempts('sarah.k@example.com')
    expect(await isRateLimited('sarah.k@example.com', now)).toBe(false)
  })

  it('blocks an IP independently of any email', async () => {
    const now = Date.now()
    for (let i = 0; i < 3; i++) await recordFailedIpAttempt('203.0.113.9', now)
    expect(await isIpRateLimited('203.0.113.9', now)).toBe(true)
    expect(await isIpRateLimited('198.51.100.4', now)).toBe(false)
    expect(await isRateLimited('sarah.k@example.com', now)).toBe(false)

    await clearIpAttempts('203.0.113.9')
    expect(await isIpRateLimited('203.0.113.9', now)).toBe(false)
  })

  // الاثنين يتشاركون نفس الجدول، فلو ما سبقنا المفاتيح بنوعها ممكن قيمة وحدة
  // تحظر الطرفين — نتأكد إن هذا ما يصير
  it('keeps an IP and an identically-named email in separate buckets', async () => {
    const now = Date.now()
    for (let i = 0; i < 3; i++) await recordFailedIpAttempt('shared-value', now)
    expect(await isIpRateLimited('shared-value', now)).toBe(true)
    expect(await isRateLimited('shared-value', now)).toBe(false)
  })
})
