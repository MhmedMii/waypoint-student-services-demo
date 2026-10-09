'use client'
import { useLanguage } from '../i18n/LanguageContext'

// الشفت يبان جنب الاسم عشان المشرف يعرف متى بيستلم: المسائي يقدر يوصله
// عميل الصبح كاحتياط، وبدون هالسطر يبان كأنه مهمل العميل
export function CounselorShiftNote({ shift }: { shift: 'day' | 'night' | null }) {
  const { t } = useLanguage()
  if (shift === null) return null
  return (
    <span className={`counselor-shift ${shift}`}>
      <span className="dot" aria-hidden />
      {t('accounts', shift === 'night' ? 'shiftNight' : 'shiftDay')}
    </span>
  )
}
