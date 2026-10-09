import { workingDaysSinceLastSeen } from '../time/workingDaysSinceLastSeen'
import { startOfKuwaitDay } from '../time/kuwaitTime'

// عند هالرقم يصير سطر الغياب أحمر ويعدّه الجرس — للعلم فقط. التوزيع ما يقرأه:
// المستشار يستلم عملاء سجّل دخول أو لا، والمتابعة مسؤوليته. خمسة = أسبوع دوام كامل
export const ABSENT_AFTER_WORKING_DAYS = 5

// الشارة بلوحة الـKPI تبان من اليوم الثاني: "مين ناقص؟". رقمان لأنهما جوابان
// لسؤالين مختلفين، والاثنين للعلم — ما واحد منهم يوقف التوزيع
export const ABSENT_BADGE_AFTER_WORKING_DAYS = 2

// "غايب" = ما سجّل دخول من خمسة أيام دوام. اللي ما دخل ولا مرة يُعتبر غايب
// كمان: حساب جديد ما يقدر يستقبل عميل قبل ما يفتح التطبيق أول مرة
export function isCounselorAbsent(lastSeenAt: Date | null, now: Date): boolean {
  const workingDays = workingDaysSinceLastSeen(lastSeenAt, now)
  if (workingDays === null) return true
  return workingDays >= ABSENT_AFTER_WORKING_DAYS
}

// سؤال ثاني غير الغياب: هذا يستلم عملاء اليوم، بس هل هو فاتح التطبيق أصلاً؟
// "اليوم" = من منتصف ليل الكويت، مو آخر ٢٤ ساعة — دخول أمس الساعة ١١ ليلاً
// مو دخول اليوم مهما كانت الساعة الحين
export function hasSignedInToday(lastSeenAt: Date | null, now: Date): boolean {
  if (lastSeenAt === null) return false
  return lastSeenAt.getTime() >= startOfKuwaitDay(now).getTime()
}
