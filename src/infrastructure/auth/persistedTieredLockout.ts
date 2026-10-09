import type { Pool } from 'pg'
import { blockDurationForFailureCount } from './tieredLockout'

export interface AsyncTieredLockout {
  isBlocked(key: string, now: number): Promise<boolean>
  recordFailedAttempt(key: string, now: number): Promise<void>
  clear(key: string): Promise<void>
}

// الصفوف اللي ما تحركت من يوم كامل ما لها لزوم — العداد يصفّر بعد ما ينتهي
// الحظر أصلاً، فالباقي مجرد تاريخ. ننظفها مع كل محاولة فاشلة (وهي نادرة).
const STALE_ROW_MS = 24 * 60 * 60 * 1000

export function createPersistedTieredLockout(pool: Pool): AsyncTieredLockout {
  return {
    async isBlocked(key, now) {
      const result = await pool.query(
        'SELECT blocked_until FROM rate_limit_lockouts WHERE lockout_key = $1',
        [key]
      )
      const blockedUntil = result.rows[0]?.blocked_until
      if (!blockedUntil) return false
      return new Date(blockedUntil).getTime() > now
    },

    async recordFailedAttempt(key, now) {
      const nowDate = new Date(now)

      // لو الحظر السابق خلص، نبدأ العد من جديد بدل ما نكمل تصعيد للأبد —
      // موظف نسي كلمة السر لازم يرجع لصفحة بيضا بعد ما يقضي مدة الحظر
      const existing = await pool.query(
        'SELECT failure_count, blocked_until FROM rate_limit_lockouts WHERE lockout_key = $1',
        [key]
      )
      const row = existing.rows[0]
      const previousBlockExpired =
        row?.blocked_until != null && new Date(row.blocked_until).getTime() <= now
      const failureCount = row && !previousBlockExpired ? row.failure_count + 1 : 1

      const blockMs = blockDurationForFailureCount(failureCount)
      const blockedUntil = blockMs > 0 ? new Date(now + blockMs) : null

      await pool.query(
        `INSERT INTO rate_limit_lockouts (lockout_key, failure_count, blocked_until, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (lockout_key)
         DO UPDATE SET failure_count = $2, blocked_until = $3, updated_at = $4`,
        [key, failureCount, blockedUntil, nowDate]
      )

      await pool.query('DELETE FROM rate_limit_lockouts WHERE updated_at < $1', [
        new Date(now - STALE_ROW_MS),
      ])
    },

    async clear(key) {
      await pool.query('DELETE FROM rate_limit_lockouts WHERE lockout_key = $1', [key])
    },
  }
}
