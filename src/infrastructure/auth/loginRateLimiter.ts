import { pool } from '../db/pool'
import { createPersistedTieredLockout } from './persistedTieredLockout'

const lockout = createPersistedTieredLockout(pool)

// الإيميلات والـ IP يتشاركون نفس الجدول، فنسبق المفتاح بنوعه عشان ما يتصادمون.
// ونصغّر حروف الإيميل عشان ما يتحايل أحد بتغيير حالة الأحرف.
const keyFor = (email: string) => `email:${email.trim().toLowerCase()}`

export async function isRateLimited(email: string, now: number): Promise<boolean> {
  return lockout.isBlocked(keyFor(email), now)
}

export async function recordFailedAttempt(email: string, now: number): Promise<void> {
  await lockout.recordFailedAttempt(keyFor(email), now)
}

export async function clearAttempts(email: string): Promise<void> {
  await lockout.clear(keyFor(email))
}
