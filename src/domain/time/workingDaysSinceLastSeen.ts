import { KUWAIT_UTC_OFFSET_MS, startOfKuwaitDay } from './kuwaitTime'

const DAY_MS = 24 * 60 * 60 * 1000
// الجمعة (5) والسبت (6) عطلة نهاية الأسبوع بالكويت — دوام الأحد إلى الخميس
const WEEKEND_WEEKDAYS = [5, 6]
// حارس: تاريخ فاسد ما يخلي الحلقة تدور بلا نهاية
const MAX_DAYS_SCANNED = 400

function kuwaitWeekday(kuwaitDayStartMs: number): number {
  return new Date(kuwaitDayStartMs + KUWAIT_UTC_OFFSET_MS).getUTCDay()
}

export function isKuwaitWorkingDay(date: Date): boolean {
  return !WEEKEND_WEEKDAYS.includes(kuwaitWeekday(startOfKuwaitDay(date).getTime()))
}

// أيام الدوام اللي فاتت من آخر ظهور لين اليوم — الجمعة والسبت ما تنعد. بالأيام
// التقويمية، كل مستشار يطلع "غايب" صبح الأحد لأن آخر ظهوره كان الخميس، فينتهي
// الأمر إن كل عميل يوصل الأحد الصبح ينرمي على "غير معيّن" ويتعوّد الفريق
// يتجاهل التنبيه. null = ما دخل ولا مرة
export function workingDaysSinceLastSeen(lastSeenAt: Date | null, now: Date): number | null {
  if (lastSeenAt === null) return null

  const from = startOfKuwaitDay(lastSeenAt).getTime()
  const to = startOfKuwaitDay(now).getTime()
  if (to <= from) return 0

  let workingDays = 0
  let scanned = 0
  for (let day = from + DAY_MS; day <= to && scanned < MAX_DAYS_SCANNED; day += DAY_MS) {
    if (!WEEKEND_WEEKDAYS.includes(kuwaitWeekday(day))) workingDays += 1
    scanned += 1
  }
  return workingDays
}
