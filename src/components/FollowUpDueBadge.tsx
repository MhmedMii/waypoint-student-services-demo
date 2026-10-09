'use client'
import { followUpDueStatus } from '../domain/time/followUpDueStatus'
import type { Language } from '../i18n/translations'
import { KUWAIT_TIME_ZONE } from '../domain/time/kuwaitTime'

interface FollowUpDueBadgeProps {
  followUpDueAt: string | null
  language: Language
  t: (
    section: 'students',
    key: 'followUpOverdue' | 'followUpOverdueNoDays' | 'followUpDueToday' | 'followUpDueOn'
  ) => string
}

// نستخدمه بأكثر من شاشة (طلابي، وزيارات الأدمن) — منطق واحد بدل ما يتكرر
export function FollowUpDueBadge({ followUpDueAt, language, t }: FollowUpDueBadgeProps) {
  if (!followUpDueAt) return null
  const due = followUpDueStatus(new Date(followUpDueAt), new Date())
  if (due.kind === 'overdue') {
    // فات موعدها بس ما مرّ يوم دوام — نقول متأخرة بلا رقم، لأن "٠ي" تقرأ كخطأ
    if (due.daysOverdue < 1) {
      return <span className="pill inactive">{t('students', 'followUpOverdueNoDays')}</span>
    }
    return (
      <span className="pill inactive">
        {t('students', 'followUpOverdue').replace('{days}', String(due.daysOverdue))}
      </span>
    )
  }
  if (due.kind === 'today') {
    return <span className="pill watch">{t('students', 'followUpDueToday')}</span>
  }
  return (
    <span className="due-later">
      {t('students', 'followUpDueOn').replace(
        '{date}',
        new Date(followUpDueAt).toLocaleDateString(language, {
          month: 'short',
          day: 'numeric',
          timeZone: KUWAIT_TIME_ZONE,
        })
      )}
    </span>
  )
}
