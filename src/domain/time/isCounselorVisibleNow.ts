import type { Shift } from '../entities/user'
import { KUWAIT_UTC_OFFSET_MS } from './kuwaitTime'

export const NIGHT_SHIFT_VISIBLE_FROM_MINUTES = 15 * 60
const NIGHT_SHIFT_VISIBLE_UNTIL_MINUTES = 22 * 60

// الكويت ما فيها توقيت صيفي، فرق ثابت +3 عن UTC كافي بدون مكتبة مناطق زمنية
function kuwaitMinutesSinceMidnight(now: Date): number {
  const kuwaitNow = new Date(now.getTime() + KUWAIT_UTC_OFFSET_MS)
  return kuwaitNow.getUTCHours() * 60 + kuwaitNow.getUTCMinutes()
}

// الدوام المسائي يظهر بالفرونت ديسك بس من 3:00م لين 10:00م بتوقيت الكويت، كل أيام الأسبوع
export function isCounselorVisibleNow(shift: Shift | null, now: Date): boolean {
  if (shift !== 'night') return true

  const minutesSinceMidnight = kuwaitMinutesSinceMidnight(now)
  return (
    minutesSinceMidnight >= NIGHT_SHIFT_VISIBLE_FROM_MINUTES &&
    minutesSinceMidnight < NIGHT_SHIFT_VISIBLE_UNTIL_MINUTES
  )
}
