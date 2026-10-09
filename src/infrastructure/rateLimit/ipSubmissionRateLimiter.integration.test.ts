// src/infrastructure/rateLimit/ipSubmissionRateLimiter.integration.test.ts
import { it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import {
  isIpSubmissionRateLimited,
  recordSubmissionAttempt,
  clearSubmissionAttempts,
} from './ipSubmissionRateLimiter'
import { isRateLimited, recordFailedAttempt } from '../auth/loginRateLimiter'
import { NextRequest } from 'next/server'
import { guardPublicSubmission } from './guardPublicSubmission'

const runIntegration = integrationDescribe

const MINUTE = 60 * 1000
const KIOSK_IP = '203.0.113.7'

runIntegration('ipSubmissionRateLimiter (integration)', () => {
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

  // هذي أهم وحدة: كل زوار الكشك يطلعون من IP واحد، فلازم يوم كامل من
  // الزيارات يعدّي بدون ما ينقفل الكشك
  // عبر الحارس الحقيقي، بنفس ترتيب المسار: يفحص ثم يسجّل
  function kioskRequest(): NextRequest {
    return new NextRequest('http://localhost/api/visits/new', {
      method: 'POST',
      headers: { 'x-forwarded-for': KIOSK_IP },
    })
  }

  it('lets a busy reception desk take exactly twenty walk-ins, and refuses the next', async () => {
    const now = Date.now()
    const refused: number[] = []
    for (let i = 0; i < 22; i++) {
      const result = await guardPublicSubmission(kioskRequest(), now + i * 1000)
      if (result.tooMany) refused.push(i + 1)
    }
    expect(refused).toEqual([21, 22])
  })

  it('blocks a burst that no human could produce', async () => {
    const now = Date.now()
    // ٢١ تقديم خلال ثواني من نفس الجهاز
    for (let i = 0; i < 21; i++) await recordSubmissionAttempt(KIOSK_IP, now + i * 100)
    expect(await isIpSubmissionRateLimited(KIOSK_IP, now)).toBe(true)
  })

  it('forgets the count after a quiet ten minutes', async () => {
    const now = Date.now()
    for (let i = 0; i < 15; i++) await recordSubmissionAttempt(KIOSK_IP, now + i * 100)

    // بعد فترة هدوء، العدّاد يبدأ من الصفر — فـ ١٥ ثانية ما تحظر
    const afterQuiet = now + 30 * MINUTE
    for (let i = 0; i < 15; i++) await recordSubmissionAttempt(KIOSK_IP, afterQuiet + i * 100)
    expect(await isIpSubmissionRateLimited(KIOSK_IP, afterQuiet)).toBe(false)
  })

  it('releases the block once it has been served', async () => {
    const now = Date.now()
    for (let i = 0; i < 21; i++) await recordSubmissionAttempt(KIOSK_IP, now + i * 100)
    expect(await isIpSubmissionRateLimited(KIOSK_IP, now)).toBe(true)
    expect(await isIpSubmissionRateLimited(KIOSK_IP, now + 11 * MINUTE)).toBe(false)
  })

  it('can be cleared by hand', async () => {
    const now = Date.now()
    for (let i = 0; i < 21; i++) await recordSubmissionAttempt(KIOSK_IP, now + i * 100)
    await clearSubmissionAttempts(KIOSK_IP)
    expect(await isIpSubmissionRateLimited(KIOSK_IP, now)).toBe(false)
  })

  // طفرة تقديم ما تقفل على أحد تسجيل الدخول، والعكس — مفاتيح منفصلة بنفس الجدول
  it('never lets form spam lock anyone out of signing in', async () => {
    const now = Date.now()
    for (let i = 0; i < 21; i++) await recordSubmissionAttempt(KIOSK_IP, now + i * 100)
    expect(await isIpSubmissionRateLimited(KIOSK_IP, now)).toBe(true)

    expect(await isRateLimited(KIOSK_IP, now)).toBe(false)
    await recordFailedAttempt('someone@example.com', now)
    expect(await isIpSubmissionRateLimited(KIOSK_IP, now)).toBe(true)
  })
})
