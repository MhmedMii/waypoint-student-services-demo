import { pool } from '../db/pool'
import { createPersistedTieredLockout } from './persistedTieredLockout'

const lockout = createPersistedTieredLockout(pool)

const keyFor = (ip: string) => `ip:${ip}`

export async function isIpRateLimited(ip: string, now: number): Promise<boolean> {
  return lockout.isBlocked(keyFor(ip), now)
}

export async function recordFailedIpAttempt(ip: string, now: number): Promise<void> {
  await lockout.recordFailedAttempt(keyFor(ip), now)
}

export async function clearIpAttempts(ip: string): Promise<void> {
  await lockout.clear(keyFor(ip))
}
