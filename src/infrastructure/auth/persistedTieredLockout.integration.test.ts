// src/infrastructure/auth/persistedTieredLockout.integration.test.ts
import { it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import { createPersistedTieredLockout } from './persistedTieredLockout'

// الحظر صار بقاعدة البيانات، والـ fake ما يثبت إن الـ SQL نفسه سليم — فهذي
// التستات تشتغل على Postgres حقيقي، وتتخطى إذا ما فيه DATABASE_URL
const runIntegration = integrationDescribe

const MINUTE = 60 * 1000

runIntegration('persistedTieredLockout (integration)', () => {
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

  it('lets the first two failures through, then blocks on the third', async () => {
    const lockout = createPersistedTieredLockout(pool)
    const now = Date.now()

    await lockout.recordFailedAttempt('email:a@example.com', now)
    await lockout.recordFailedAttempt('email:a@example.com', now)
    expect(await lockout.isBlocked('email:a@example.com', now)).toBe(false)

    await lockout.recordFailedAttempt('email:a@example.com', now)
    expect(await lockout.isBlocked('email:a@example.com', now)).toBe(true)
    expect(await lockout.isBlocked('email:a@example.com', now + 2 * MINUTE)).toBe(true)
    expect(await lockout.isBlocked('email:a@example.com', now + 4 * MINUTE)).toBe(false)
  })

  it('holds longer the further past the tiers it goes', async () => {
    const lockout = createPersistedTieredLockout(pool)
    const now = Date.now()

    for (let i = 0; i < 5; i++) await lockout.recordFailedAttempt('email:b@example.com', now)
    expect(await lockout.isBlocked('email:b@example.com', now + 4 * MINUTE)).toBe(true)

    for (let i = 0; i < 3; i++) await lockout.recordFailedAttempt('email:b@example.com', now)
    expect(await lockout.isBlocked('email:b@example.com', now + 14 * MINUTE)).toBe(true)
    expect(await lockout.isBlocked('email:b@example.com', now + 16 * MINUTE)).toBe(false)
  })

  // هذي أهم واحدة: بدونها الموظف اللي ينسى كلمة السر يظل يتصعّد عليه الحظر
  // للأبد، لأن تصفير العداد ما يصير إلا بدخول ناجح — وهو ما يقدر يدخل وهو محظور
  it('starts counting afresh once a block has been served', async () => {
    const lockout = createPersistedTieredLockout(pool)
    const now = Date.now()

    for (let i = 0; i < 8; i++) await lockout.recordFailedAttempt('email:c@example.com', now)
    expect(await lockout.isBlocked('email:c@example.com', now + 10 * MINUTE)).toBe(true)

    // بعد ما تنتهي مدة الحظر، محاولة فاشلة وحدة ما ترجّعه محظور فورًا
    const afterBlock = now + 16 * MINUTE
    await lockout.recordFailedAttempt('email:c@example.com', afterBlock)
    expect(await lockout.isBlocked('email:c@example.com', afterBlock)).toBe(false)

    // ويحتاج ثلاث محاولات من جديد عشان ينحظر مرة ثانية
    await lockout.recordFailedAttempt('email:c@example.com', afterBlock)
    await lockout.recordFailedAttempt('email:c@example.com', afterBlock)
    expect(await lockout.isBlocked('email:c@example.com', afterBlock)).toBe(true)
  })

  it('forgets everything about a key after a successful sign-in', async () => {
    const lockout = createPersistedTieredLockout(pool)
    const now = Date.now()

    for (let i = 0; i < 3; i++) await lockout.recordFailedAttempt('email:d@example.com', now)
    expect(await lockout.isBlocked('email:d@example.com', now)).toBe(true)

    await lockout.clear('email:d@example.com')
    expect(await lockout.isBlocked('email:d@example.com', now)).toBe(false)
  })

  it('keeps one key from affecting another', async () => {
    const lockout = createPersistedTieredLockout(pool)
    const now = Date.now()

    for (let i = 0; i < 3; i++) await lockout.recordFailedAttempt('email:e@example.com', now)
    expect(await lockout.isBlocked('email:e@example.com', now)).toBe(true)
    expect(await lockout.isBlocked('ip:203.0.113.9', now)).toBe(false)
  })

  it('clears out rows nobody has touched for a day', async () => {
    const lockout = createPersistedTieredLockout(pool)
    const now = Date.now()

    await lockout.recordFailedAttempt('email:old@example.com', now)
    expect((await pool.query('SELECT * FROM rate_limit_lockouts')).rowCount).toBe(1)

    // أي محاولة لاحقة بعد يوم كامل تنظف الصفوف القديمة معها
    await lockout.recordFailedAttempt('email:new@example.com', now + 25 * 60 * MINUTE)
    const keys = (await pool.query('SELECT lockout_key FROM rate_limit_lockouts')).rows.map(
      (r) => r.lockout_key
    )
    expect(keys).toEqual(['email:new@example.com'])
  })
})
