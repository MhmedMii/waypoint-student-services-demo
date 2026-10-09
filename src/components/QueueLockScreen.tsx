'use client'
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { countCategory } from '../i18n/countCategory'
import { KUWAIT_TIME_ZONE, startOfKuwaitDay } from '../domain/time/kuwaitTime'

const POLL_INTERVAL_MS = 3000

const PEOPLE_AHEAD_KEY = {
  one: 'peopleAheadOne',
  two: 'peopleAheadTwo',
  few: 'peopleAheadFew',
  many: 'peopleAheadMany',
} as const

interface CounselorShiftInfo {
  shift: 'day' | 'night'
  availableFromMinutes: number
}

interface QueuePositionResponse {
  ok: boolean
  position?: number
  counselorName?: string | null
  calledIn?: boolean
  counselorShift?: CounselorShiftInfo | null
}

// الساعة تُبنى من نفس الرقم اللي يقرر الظهور بالسيرفر، فما تقدر الرسالة
// تخالف الفلتر. ونعرضها بلغة الزائر بدل ما نكتب "3:00 PM" بالنص
function shiftStartLabel(minutes: number, language: string): string {
  // setHours كانت تضبط الساعة بمنطقة جهاز الزائر، ثم نعرضها بتوقيت الكويت —
  // تحويل مرتين. نبني اللحظة من منتصف ليل الكويت مباشرة، فالكشك يقول الثالثة
  // مهما كانت منطقة الجهاز مضبوطة غلط
  const at = new Date(startOfKuwaitDay(new Date()).getTime() + minutes * 60_000)
  return at.toLocaleTimeString(language, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: KUWAIT_TIME_ZONE,
  })
}

interface QueueLockScreenProps {
  visitId: string
  initialCounselorName: string | null
  onUnlocked: () => void
}

export function QueueLockScreen({
  visitId,
  initialCounselorName,
  onUnlocked,
}: QueueLockScreenProps) {
  const { t, language } = useLanguage()
  const [position, setPosition] = useState<number | null>(null)
  const [counselorName, setCounselorName] = useState<string | null>(initialCounselorName)
  const [counselorShift, setCounselorShift] = useState<CounselorShiftInfo | null>(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const response = await fetch(`/api/visits/${visitId}/queue-position`)
        const data: QueuePositionResponse = await response.json()
        if (cancelled || !data.ok) return
        setPosition(data.position ?? 0)
        if (data.counselorName) setCounselorName(data.counselorName)
        setCounselorShift(data.counselorShift ?? null)
        if (data.calledIn) onUnlocked()
      } catch {
        // نتجاهل فشل استعلام مؤقت — بنحاول مرة ثانية بالـ interval الجاي
      }
    }

    // نتجاهل التكة والتبويب مخفي (مثلاً الزائر بدّل تطبيق على جواله) —
    // ونستعلم فورًا لما يرجع ظاهر بدل ما ننتظر الـinterval الجاي
    function tick() {
      if (!document.hidden) poll()
    }

    tick()
    const interval = setInterval(tick, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [visitId, onUnlocked])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    // نمنع زر الرجوع بإعادة دفع نفس الحالة كل ما المستخدم يحاول يرجع،
    // عشان الشاشة تظل مقفولة لحد ما المستشار يستدعيه فعليًا
    function handlePopState() {
      window.history.pushState(null, '', window.location.href)
    }

    window.history.pushState(null, '', window.location.href)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  return (
    <div className="queue-lock-screen">
      <div className="queue-lock-icon">🔒</div>
      <div className="queue-lock-num">{position ?? '…'}</div>
      {/* الرقم فوق والمعدود تحته: لازم يتصرّف معه — "1 people" غلط
          بالإنجليزي، والعربي له أربع صيغ مو صيغتين */}
      <div className="queue-lock-sub">
        {t('intake', PEOPLE_AHEAD_KEY[countCategory(position ?? 0)])}
      </div>
      {counselorName && (
        <div className="queue-lock-counselor">
          <span className="k">{t('intake', 'yourCounselor')}</span>
          <span className="v">{counselorName}</span>
          {/* الشفت فقط — الزائر ما يُقال له إن مستشاره غايب من كذا يوم */}
          {counselorShift && (
            <span className="queue-lock-shift">
              {t(
                'intake',
                counselorShift.shift === 'night' ? 'shiftEveningFrom' : 'shiftMorningFrom'
              ).replace('{time}', shiftStartLabel(counselorShift.availableFromMinutes, language))}
            </span>
          )}
        </div>
      )}
      <div className="queue-lock-warn">{t('intake', 'queueLockWarning')}</div>
    </div>
  )
}
