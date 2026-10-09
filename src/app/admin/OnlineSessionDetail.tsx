'use client'
import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { localizedName } from '../../i18n/localizedName'
import { formatDurationHMS } from '../../domain/time/formatDurationHMS'
import { kuwaitDayKey, startOfKuwaitDay, KUWAIT_TIME_ZONE } from '../../domain/time/kuwaitTime'

const DAYS_SHOWN = 7
const SECONDS_PER_DAY = 24 * 60 * 60

interface SessionRow {
  startedAt: string
  endedAt: string
}

interface SessionsResponse {
  ok: boolean
  totalSeconds: number
  sessions: SessionRow[]
}

function toDateKey(date: Date): string {
  return kuwaitDayKey(date)
}

function localeFor(language: 'en' | 'ar'): string {
  return language === 'ar' ? 'ar' : 'en-US'
}

function formatTimeOfDay(iso: string, language: 'en' | 'ar'): string {
  return new Date(iso).toLocaleTimeString(localeFor(language), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: KUWAIT_TIME_ZONE,
  })
}

function formatDayLabel(date: Date, language: 'en' | 'ar'): { weekday: string; day: number } {
  const weekday = date.toLocaleDateString(localeFor(language), {
    weekday: 'short',
    timeZone: KUWAIT_TIME_ZONE,
  })
  return {
    weekday: language === 'ar' ? weekday : weekday.toUpperCase(),
    // رقم اليوم لازم يطابق المفتاح المرسل للسيرفر — getDate() ساعة الجهاز
    day: Number(kuwaitDayKey(date).slice(8, 10)),
  }
}

// موضع الشريط على المحور: ثوانٍ من منتصف ليل الكويت، مو من منتصف ليل الجهاز
function secondsSinceMidnight(iso: string): number {
  const date = new Date(iso)
  return Math.floor((date.getTime() - startOfKuwaitDay(date).getTime()) / 1000)
}

// كان يبني منتصف ليل الجهاز ثم يقرأ المفتاح بـUTC، فكل زر بالشريط يسأل عن
// اليوم اللي قبله — واليوم الحالي ما يتحدّد أبدًا كنشط
function lastNDays(n: number): Date[] {
  const today = startOfKuwaitDay(new Date())
  return Array.from(
    { length: n },
    (_, i) => new Date(today.getTime() - (n - 1 - i) * 24 * 60 * 60 * 1000)
  )
}

async function fetchSessions(userId: string, dateKey: string): Promise<SessionsResponse> {
  const response = await fetch(`/api/admin/online/${userId}/sessions?date=${dateKey}`)
  return response.json()
}

export function OnlineSessionDetail({
  userId,
  name,
  nameAr,
  onClose,
}: {
  userId: string
  name: string
  nameAr: string | null
  onClose: () => void
}) {
  const { t, language } = useLanguage()
  const days = lastNDays(DAYS_SHOWN)
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()))
  const [data, setData] = useState<SessionsResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSessions(userId, selectedDateKey).then((result) => {
      if (!cancelled) setData(result)
    })
    return () => {
      cancelled = true
    }
  }, [userId, selectedDateKey])

  const sessions = data?.ok ? data.sessions : []
  const totalSeconds = data?.ok ? data.totalSeconds : 0

  return (
    <div className="session-slide">
      <div className="session-slide-head">
        <h3>{localizedName(name, nameAr, language)}</h3>
        <button
          type="button"
          className="session-slide-close"
          onClick={onClose}
          aria-label={t('admin', 'close')}
        >
          ×
        </button>
      </div>

      <div className="cal-strip">
        {days.map((day) => {
          const dateKey = toDateKey(day)
          const label = formatDayLabel(day, language)
          return (
            <button
              key={dateKey}
              type="button"
              className={`cal-day${dateKey === selectedDateKey ? ' active' : ''}`}
              onClick={() => setSelectedDateKey(dateKey)}
            >
              {label.weekday}
              <span className="n">{label.day}</span>
            </button>
          )
        })}
      </div>

      <div className="session-timeline">
        {sessions.map((s, i) => {
          const left = (secondsSinceMidnight(s.startedAt) / SECONDS_PER_DAY) * 100
          const width =
            ((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) /
              1000 /
              SECONDS_PER_DAY) *
            100
          return (
            <div
              key={i}
              className="session-timeline-block"
              style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
            />
          )
        })}
      </div>
      <div className="session-timeline-labels">
        <span>{t('admin', 'timelineMidnight')}</span>
        <span>{t('admin', 'timeline6am')}</span>
        <span>{t('admin', 'timelineNoon')}</span>
        <span>{t('admin', 'timeline6pm')}</span>
        <span>{t('admin', 'timelineMidnight')}</span>
      </div>

      {sessions.length === 0 ? (
        <p className="session-empty">{t('admin', 'noSessionsThisDay')}</p>
      ) : (
        <div className="session-list">
          {sessions.map((s, i) => (
            <div className="session-row" key={i}>
              <span className="session-time">
                <span className="session-dot" />
                {formatTimeOfDay(s.startedAt, language)} – {formatTimeOfDay(s.endedAt, language)}
              </span>
              <span className="session-dur">
                {formatDurationHMS(
                  (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000,
                  language
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="session-total">
        <span>{t('admin', 'totalOnline')}</span>
        <b>{formatDurationHMS(totalSeconds, language)}</b>
      </div>
    </div>
  )
}
