import { hasSignedInToday, isCounselorAbsent } from '../../domain/routing/counselorAbsence'
import { workingDaysSinceLastSeen } from '../../domain/time/workingDaysSinceLastSeen'
import { countCategory } from '../../i18n/countCategory'

// الفاصل اللي تعتمد عليه لوحة السجل عشان تلوّن الذيل بس. النص محفوظ نص عادي
// بقاعدة البيانات، فما فيه طريقة نخزّن "هالنص أحمر" — نخزّن جملة واحدة
// ونخلّي الشاشة تقسمها على هالعلامة بالضبط
export const DETAIL_TAIL_SEPARATOR = ' — '

export interface FollowUpCounselorLog {
  action: 'follow_up_counselor_not_in' | 'follow_up_absent_counselor'
  en: string
  ar: string
}

interface CounselorLike {
  name: string
  // اختياري عمداً: User.nameAr ممكن تكون undefined، فما نجبر المنادي يحوّلها
  nameAr?: string | null
  lastSeenAt: Date | null
}

function tail(quietWorkingDays: number | null): { en: string; ar: string } {
  if (quietWorkingDays === null) {
    // ما فتح التطبيق ولا مرة — "من ٠ يوم" كذب
    return { en: 'never signed in', ar: 'ما سجّل دخول أبداً' }
  }
  if (quietWorkingDays < 1) {
    // آخر دخول أمس والحين جمعة أو سبت: ما حضر اليوم، بس ما مرّ يوم دوام بعد
    return { en: 'not in today', ar: 'ما حضر اليوم' }
  }
  // نفس قاعدة العدد المشتركة اللي تستخدمها الشاشات — مكان واحد يتغيّر
  const category = countCategory(quietWorkingDays)
  if (category === 'one') return { en: 'not in 1 working day', ar: 'ما حضر من يوم عمل' }
  if (category === 'two') return { en: 'not in 2 working days', ar: 'ما حضر من يومي عمل' }
  const arNoun = category === 'many' ? 'يوم عمل' : 'أيام عمل'
  return {
    en: `not in ${quietWorkingDays} working days`,
    ar: `ما حضر من ${quietWorkingDays} ${arNoun}`,
  }
}

// زيارة المتابعة ما تمر بالتوزيع: العميل يختار مستشاره بنفسه من الكشك، وإحنا
// ننفّذ اختياره كما هو. هذا السطر ما يغيّر الاختيار — بس يسجّله، عشان ما نكتشف
// إن الطابور صار ٤١ بعد شهر. يرجّع null إذا المستشار حاضر اليوم: اليوم العادي
// يبقى بنفس شكله بالسجل
export function followUpCounselorLog(
  clientName: string,
  counselor: CounselorLike | null,
  now: Date
): FollowUpCounselorLog | null {
  if (counselor === null) return null
  if (hasSignedInToday(counselor.lastSeenAt, now)) return null

  const words = tail(workingDaysSinceLastSeen(counselor.lastSeenAt, now))
  const arabicName = counselor.nameAr ?? counselor.name

  return {
    action: isCounselorAbsent(counselor.lastSeenAt, now)
      ? 'follow_up_absent_counselor'
      : 'follow_up_counselor_not_in',
    en: `${clientName} chose ${counselor.name}${DETAIL_TAIL_SEPARATOR}${words.en}`,
    ar: `${clientName} اختار ${arabicName}${DETAIL_TAIL_SEPARATOR}${words.ar}`,
  }
}
