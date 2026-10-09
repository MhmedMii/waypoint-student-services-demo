// src/infrastructure/rateLimit/repeatSubmitterLimiter.integration.test.ts
import { it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import {
  isRepeatSubmitterBlocked,
  recordPhoneSubmission,
  clearPhoneSubmissions,
} from './repeatSubmitterLimiter'
import { guardRepeatSubmitter } from './guardPublicSubmission'

const runIntegration = integrationDescribe

const MINUTE = 60 * 1000
const PHONE = '56012345'

runIntegration('repeatSubmitterLimiter (integration)', () => {
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

  // التست القديم كان يسجّل ثم يفحص، والتطبيق يفحص ثم يسجّل — فكان يعدّي وهو
  // الحد الفعلي أربعة مو ثلاثة. الآن نمر من الحارس نفسه اللي تناديه المسارات،
  // فما يقدر التست ينفصل عن ترتيب التطبيق مرة ثانية
  it('accepts exactly three submissions through the guard, and refuses the fourth', async () => {
    const now = Date.now()
    const answers: boolean[] = []
    for (let i = 0; i < 5; i++) {
      const result = await guardRepeatSubmitter(PHONE, now + i * MINUTE)
      answers.push(result.tooMany)
    }
    expect(answers).toEqual([false, false, false, true, true])
  })

  it('blocks as soon as the third submission is recorded', async () => {
    const now = Date.now()
    for (let i = 0; i < 2; i++) await recordPhoneSubmission(PHONE, now + i * MINUTE)
    expect(await isRepeatSubmitterBlocked(PHONE, now + 2 * MINUTE)).toBe(false)

    await recordPhoneSubmission(PHONE, now + 2 * MINUTE)
    expect(await isRepeatSubmitterBlocked(PHONE, now + 2 * MINUTE)).toBe(true)
  })

  it('never blocks a different person', async () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) await recordPhoneSubmission(PHONE, now + i * 100)
    expect(await isRepeatSubmitterBlocked(PHONE, now)).toBe(true)
    expect(await isRepeatSubmitterBlocked('56099999', now)).toBe(false)
  })

  it('lets them back in once the block has passed', async () => {
    const now = Date.now()
    for (let i = 0; i < 4; i++) await recordPhoneSubmission(PHONE, now + i * 100)
    expect(await isRepeatSubmitterBlocked(PHONE, now)).toBe(true)
    expect(await isRepeatSubmitterBlocked(PHONE, now + 16 * MINUTE)).toBe(false)
  })

  it('starts counting again after a quiet quarter of an hour', async () => {
    const now = Date.now()
    for (let i = 0; i < 3; i++) await recordPhoneSubmission(PHONE, now + i * 100)

    // زيارة ثانية بنفس اليوم بعد فترة — ما تنحسب على القديمة
    const laterVisit = now + 20 * MINUTE
    await recordPhoneSubmission(PHONE, laterVisit)
    expect(await isRepeatSubmitterBlocked(PHONE, laterVisit)).toBe(false)
  })

  it('stores a fingerprint of the number, never the number itself', async () => {
    const now = Date.now()
    await recordPhoneSubmission(PHONE, now)

    const keys = (await pool.query('SELECT lockout_key FROM rate_limit_lockouts')).rows.map(
      (r) => r.lockout_key
    )
    expect(keys).toHaveLength(1)
    expect(keys[0]).not.toContain(PHONE)
    expect(keys[0]).toMatch(/^submitphone:[0-9a-f]{64}$/)
  })

  it('can be cleared by hand', async () => {
    const now = Date.now()
    for (let i = 0; i < 4; i++) await recordPhoneSubmission(PHONE, now + i * 100)
    await clearPhoneSubmissions(PHONE)
    expect(await isRepeatSubmitterBlocked(PHONE, now)).toBe(false)
  })
})
