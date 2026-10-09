import { startOfKuwaitDay } from './kuwaitTime'
import { workingDaysSinceLastSeen } from './workingDaysSinceLastSeen'

export type FollowUpDueStatus =
  { kind: 'overdue'; daysOverdue: number } | { kind: 'today' } | { kind: 'upcoming' }

// نقارن حدود اليوم بتوقيت الكويت، بنفس الاتفاقية المستخدمة بباقي حسابات
// "اليوم" بالتطبيق — عشان "اليوم" هنا يطابق "اليوم" بالداشبورد والإشراف.
//
// العدد المعروض بأيام الدوام لا بأيام التقويم: متابعة مستحقة الخميس كانت
// تقول "متأخرة ٣ أيام" صبح الأحد، بينما اللي مرّ يوم دوام واحد — المستشار
// ما كان عنده يومان يشتغل فيهما. هذا رابع ظهور لنفس الخلل، والدالة موجودة
// أصلاً وتتخطى الجمعة والسبت، فنستوردها بدل ما نكتب حسابًا خامسًا
export function followUpDueStatus(dueAt: Date, now: Date): FollowUpDueStatus {
  const dueDay = startOfKuwaitDay(dueAt).getTime()
  const today = startOfKuwaitDay(now).getTime()
  if (dueDay === today) return { kind: 'today' }
  if (dueDay > today) return { kind: 'upcoming' }

  // صفر ممكنة ومعناها واضح: التاريخ فات بس ما مرّ يوم دوام بعد — مستحقة
  // الخميس ومعروضة الجمعة. الشارة تعرضها بلا رقم بدل "متأخرة · ٠ي"
  return { kind: 'overdue', daysOverdue: workingDaysSinceLastSeen(dueAt, now) ?? 0 }
}
