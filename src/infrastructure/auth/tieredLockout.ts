export interface TieredLockout {
  isBlocked(key: string, now: number): boolean
  recordFailedAttempt(key: string, now: number): void
  clear(key: string): void
}

interface LockoutRecord {
  failureCount: number
  blockedUntil: number
}

// كل محاولة فاشلة تزود العداد وتحدد مدة الحظر حسب أعلى درجة توصلها العداد،
// العداد نفسه ما يرجع صفر تلقائيًا — بس تسجيل دخول ناجح (clear) يصفره
export const LOCKOUT_TIERS: Array<{ atFailureCount: number; blockMs: number }> = [
  { atFailureCount: 8, blockMs: 15 * 60 * 1000 },
  { atFailureCount: 5, blockMs: 5 * 60 * 1000 },
  { atFailureCount: 3, blockMs: 3 * 60 * 1000 },
]

export function blockDurationForFailureCount(failureCount: number): number {
  const tier = LOCKOUT_TIERS.find((candidate) => failureCount >= candidate.atFailureCount)
  return tier?.blockMs ?? 0
}

export function createTieredLockout(): TieredLockout {
  const recordsByKey = new Map<string, LockoutRecord>()

  return {
    isBlocked(key, now) {
      const record = recordsByKey.get(key)
      if (!record) return false
      return now < record.blockedUntil
    },
    recordFailedAttempt(key, now) {
      const previous = recordsByKey.get(key)
      const failureCount = (previous?.failureCount ?? 0) + 1
      const blockMs = blockDurationForFailureCount(failureCount)
      const blockedUntil = blockMs > 0 ? now + blockMs : (previous?.blockedUntil ?? 0)
      recordsByKey.set(key, { failureCount, blockedUntil })
    },
    clear(key) {
      recordsByKey.delete(key)
    },
  }
}
