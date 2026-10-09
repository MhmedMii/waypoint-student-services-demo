import { KUWAIT_UTC_OFFSET_MS, startOfKuwaitDay } from './kuwaitTime'
import { isKuwaitWorkingDay } from './workingDaysSinceLastSeen'

const DAY_MS = 24 * 60 * 60 * 1000

// ثلاثة أيام دوام، مو ثلاثة أيام تقويم. الفرق مهم: زيارة تُقفل الأربعاء كانت
// تقترح السبت — يوم عطلة بالكويت، فالمتابعة تصير متأخرة قبل ما يشوفها أحد،
// وترفع عدّاد "المتأخرة" باللوحة بلا سبب حقيقي
export const DEFAULT_FOLLOW_UP_WORKING_DAYS = 3

// وحدّ ما ينتهي أبداً لو انكسر شي بحساب العطلة — نفس حارس workingDaysSinceLastSeen
const MAX_DAYS_SCANNED = 30

export function defaultFollowUpDueDate(now: Date = new Date()): string {
  // كان يجمع بالتوقيت المحلي ويقرأ بـ UTC: بين منتصف الليل والثالثة فجراً
  // بالكويت يطلع اليوم اللي قبله. والدالتان تُنادى من المتصفح، يعني ساعة
  // موظفة الاستقبال هي المرجع — فلازم نثبّت على حدود يوم الكويت
  let cursor = startOfKuwaitDay(now).getTime()
  let workingDaysAdded = 0
  let scanned = 0

  while (workingDaysAdded < DEFAULT_FOLLOW_UP_WORKING_DAYS && scanned < MAX_DAYS_SCANNED) {
    cursor += DAY_MS
    scanned += 1
    if (isKuwaitWorkingDay(new Date(cursor))) workingDaysAdded += 1
  }

  // التاريخ كما يقرأه من بالكويت، لا كما يقع بـ UTC
  return new Date(cursor + KUWAIT_UTC_OFFSET_MS).toISOString().slice(0, 10)
}
