'use client'
import { useLanguage } from '../i18n/LanguageContext'
import { ABSENT_AFTER_WORKING_DAYS } from '../domain/routing/counselorAbsence'
import { countCategory } from '../i18n/countCategory'

const NOT_IN_KEY = {
  one: 'notInOneDay',
  two: 'notInTwoDays',
  few: 'notInManyDays',
  many: 'notInManyDaysLong',
} as const

interface Props {
  // الزيارة المقفلة ما تسأل "فيه أحد جاي لهذا العميل؟" — انتهت. نصف الصفوف
  // مقفلة، فبدون هالشرط يصير نصف السطور ضجيج
  isOpen: boolean
  signedInToday: boolean | null
  quietWorkingDays: number | null
}

// سطر تحت الاسم، مو شارة: الشارة كانت أعرض من العمود فتلف على سطر لحالها
// وتدفع زر الإلغاء لسطر ثالث بعيد عن صاحبه. القيم تنحسب بالسيرفر من
// last_seen_at بكل طلب، فالسطر يختفي بنفسه أول ما يسجّل دخول
export function CounselorAwayNote({ isOpen, signedInToday, quietWorkingDays }: Props) {
  const { t } = useLanguage()
  if (!isOpen) return null
  if (signedInToday !== false) return null

  // أحمر يعني شي محدد: التوزيع وقف يعطيه عملاء جدد. مو مجرد "غاب أكثر"
  const isAbsent = quietWorkingDays === null || quietWorkingDays >= ABSENT_AFTER_WORKING_DAYS

  let text: string
  if (quietWorkingDays === null) {
    // معيّن يدويًا لحساب ما فُتح ولا مرة — "من ٠ يوم" كذب
    text = t('visits', 'neverSignedIn')
  } else if (quietWorkingDays < 1) {
    // آخر دخول أمس والحين جمعة أو سبت: ما حضر اليوم، بس ما مرّ يوم دوام بعد
    text = t('visits', 'notInToday')
  } else {
    // نفس قاعدة العدد المشتركة — مفرد، مثنى، جمع قلة، ثم مفرد منصوب من ١١
    text = t('visits', NOT_IN_KEY[countCategory(quietWorkingDays)]).replace(
      '{days}',
      String(quietWorkingDays)
    )
  }

  return <span className={`counselor-away ${isAbsent ? 'absent' : ''}`}>{text}</span>
}
