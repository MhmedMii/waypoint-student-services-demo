import type { UserRepository } from '../ports/UserRepository'
import type { Clock } from '../ports/Clock'
import { hasSignedInToday } from '../../domain/routing/counselorAbsence'
import { workingDaysSinceLastSeen } from '../../domain/time/workingDaysSinceLastSeen'
import { isOnlineNow } from '../../domain/time/presenceTiming'

export interface CounselorNaming {
  counselorName: string | null
  counselorNameAr: string | null
  // نفس الصف ونفس الاستعلام: لو حسبناها بالواجهة احتجنا قائمة مستشارين ثانية،
  // وهي بالضبط القائمة اللي علّمتنا ما نعتمد عليها. غير معيّن = null مو false،
  // عشان "ما فيه مستشار" ما تنقرأ كأنها "فيه واحد وما سجّل دخول"
  counselorSignedInToday: boolean | null
  // كم يوم دوام مرّ من آخر دخول. null = ما فيه مستشار، أو فيه بس ما دخل ولا
  // مرة — اللصيقة تفرّق بينهما بـcounselorSignedInToday
  counselorQuietWorkingDays: number | null
  // المسائي يستلم عملاء الصبح كاحتياط — الصف لازم يقول متى بيجي
  counselorShift: 'day' | 'night' | null
  // أونلاين الحين (نبضة خلال دقيقتين). null = ما فيه مستشار، مو "أوفلاين"
  counselorOnline: boolean | null
  // "جاء إلى": المستشار اللي طلبه العميل بالكشك (المتابعة بس). null = ما طلب
  // أحد، أو زيارة قديمة ما انسجل فيها — الواجهة تفرّق بالنوع
  requestedCounselorName: string | null
  requestedCounselorNameAr: string | null
}

// القاعدة: الاسم يتحلّ بالسيرفر دائمًا. أي قائمة مفلترة بالواجهة — "النشطين"،
// "اللي بالدوام الآن" — تصلح لاختيار مين يستلم، ما تصلح لتسمية مين استلم:
// الشخص اللي برّا القائمة وقتها يطلع معرّفه الخام مكان اسمه، وهذا اللي صار
// بجدول التأشيرات. وتحلّ الاسم بالسيرفر يشمل المعطّل واللي تغيّر دوره كمان
export async function withCounselorNames<
  T extends { counselorId: string | null; requestedCounselorId?: string | null },
>(rows: T[], userRepository: UserRepository, clock: Clock): Promise<Array<T & CounselorNaming>> {
  const users = await userRepository.findAll()
  const byId = new Map(users.map((user) => [user.id, user]))
  const now = clock.now()
  return rows.map((row) => {
    const counselor = row.counselorId ? byId.get(row.counselorId) : undefined
    const requested = row.requestedCounselorId ? byId.get(row.requestedCounselorId) : undefined
    return {
      ...row,
      counselorName: counselor?.name ?? null,
      counselorNameAr: counselor?.nameAr ?? null,
      counselorSignedInToday: counselor ? hasSignedInToday(counselor.lastSeenAt, now) : null,
      counselorQuietWorkingDays: counselor
        ? workingDaysSinceLastSeen(counselor.lastSeenAt, now)
        : null,
      counselorShift: counselor?.shift ?? null,
      counselorOnline: counselor ? isOnlineNow(counselor.lastSeenAt, now) : null,
      requestedCounselorName: requested?.name ?? null,
      requestedCounselorNameAr: requested?.nameAr ?? null,
    }
  })
}
