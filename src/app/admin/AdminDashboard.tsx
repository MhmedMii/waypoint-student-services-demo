// src/app/admin/AdminDashboard.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { localizedName } from '../../i18n/localizedName'
import { COUNTRY_LABEL_KEYS, isKnownCountryScope } from '../../i18n/countryLabels'
import {
  DATE_RANGE_PRESETS,
  computeDateRangeForPreset,
  type DateRangePreset,
} from '../../domain/time/dateRangePresets'
import { kuwaitRangeQuery } from '../../domain/time/kuwaitDateRange'
import { workingDaysSinceLastSeen } from '../../domain/time/workingDaysSinceLastSeen'
import { ABSENT_BADGE_AFTER_WORKING_DAYS } from '../../domain/routing/counselorAbsence'
import { UNASSIGNED_COUNSELOR_ID } from '../../domain/routing/unassignedCounselor'
import { handlingBadges, type TranslateFn } from './handlingBadges'
import { presetLabelKey } from './presetLabelKey'
import { useAdminNotifications, openNotificationsPanel } from '../../hooks/useAdminNotifications'
import { redClientCount } from '../../application/useCases/getAdminNotifications'

// الداشبورد يعيد تحميل الأرقام ويحدّث "اليوم" كل دقيقة، وكل ما يرجع المستخدم
// للتبويب — الشاشة اللي تنترك مفتوحة أيام ما تظل عالقة على تاريخ قديم
const REFRESH_INTERVAL_MS = 60_000
// أسبوع دوام كامل بدون تسجيل دخول أخطر من غياب يومين-ثلاثة — نلوّنها أحمر عشان
// تفرق بصريًا عن الغياب القصير، مع إنها نفس الحالة منطقيًا
const LONG_ABSENT_WORKING_DAYS = 5

interface AdminKpisView {
  totalByType: { new: number; follow_up: number; visa: number }
  countryBreakdown: Array<{ country: string; count: number }>
  funnel: { next: number; closed: number }
  counselorPerformance: Array<{
    counselorId: string
    counselorName: string
    counselorNameAr: string | null
    active: boolean
    lastSeenAt: string | null
    visitCount: number
    closedCount: number
    avgHandlingMs: number | null
    instantCloseCount: number
    instantCloseAvgMs: number | null
    leftOpenCount: number
    leftOpenAvgMs: number | null
    applicationCount: number
  }>
  turnaround: { within24h: number; over24h: number; inProgress: number }
  followUpsDue: { total: number; overdue: number }
}

// "361 min" يصعب قراءته بسرعة — فوق الساعة نعرضه "6h 1m" بدل عدد دقايق طويل
function formatAvgHandling(
  ms: number | null,
  minutesAbbrev: string,
  language: 'en' | 'ar'
): string {
  if (ms === null) return '—'
  const totalMinutes = Math.round(ms / 60000)
  if (totalMinutes <= 60) return `${totalMinutes} ${minutesAbbrev}`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const hoursLabel = language === 'ar' ? 'س' : 'h'
  const minutesLabel = language === 'ar' ? 'د' : 'm'
  return minutes > 0 ? `${hours}${hoursLabel} ${minutes}${minutesLabel}` : `${hours}${hoursLabel}`
}

// المتوسط الرئيسي يُحسب من الجلسات "النظيفة" بس — لو صفر جلسات نظيفة تبقى،
// نعرض "—" بدل ما نكرر متوسط مجموعة استُثنيت أصلًا من الحساب. ولو الجلسة
// النظيفة الوحيدة كانت زيارة واحدة، نضيف ملاحظة صغيرة إنه ما زال عيّنة صغيرة
function handlingDisplay(
  c: {
    avgHandlingMs: number | null
    closedCount: number
    instantCloseCount: number
    leftOpenCount: number
  },
  t: TranslateFn,
  minutesAbbrev: string,
  language: 'en' | 'ar'
): { primary: string; note: string | null; badges: ReturnType<typeof handlingBadges> } {
  const badges = handlingBadges(c, t)
  if (c.avgHandlingMs === null) return { primary: '—', note: null, badges }
  const cleanCount = c.closedCount - c.instantCloseCount - c.leftOpenCount
  const note = cleanCount === 1 ? t('admin', 'handlingSingleSampleNote') : null
  return { primary: formatAvgHandling(c.avgHandlingMs, minutesAbbrev, language), note, badges }
}

// نستنتج حالة بسيطة من عدد الزيارات المفتوحة مقابل المغلقة، عشان نعطي
// إشارة سريعة للأدمن بدون داشبورد تحليلات معقد — 4 مستويات: جيد / متأخر شوي /
// محمّل زيادة / غايب. "غايب" له أولوية على "محمّل زيادة": نفس رقم الزيارات
// المفتوحة يعني شي مختلف تمامًا لو المستشار أصلاً مو حاضر يشتغل عليها
function backlogStatus(
  counselorId: string,
  visitCount: number,
  closedCount: number,
  daysAbsent: number | null
): 'on-track' | 'watch' | 'inactive' | 'unassigned' | 'absent' {
  if (counselorId === UNASSIGNED_COUNSELOR_ID) return 'unassigned'
  const openCount = visitCount - closedCount
  if (daysAbsent !== null && daysAbsent >= ABSENT_BADGE_AFTER_WORKING_DAYS && openCount > 0)
    return 'absent'
  if (openCount > 6) return 'inactive'
  return openCount > 3 ? 'watch' : 'on-track'
}

function statusLabelKey(
  status: 'on-track' | 'watch' | 'inactive' | 'unassigned'
): 'statusOnTrack' | 'statusWatch' | 'statusOverloaded' | 'statusUnassigned' {
  if (status === 'unassigned') return 'statusUnassigned'
  if (status === 'inactive') return 'statusOverloaded'
  return status === 'on-track' ? 'statusOnTrack' : 'statusWatch'
}

export function AdminDashboard({ role }: { role: 'admin' | 'super_admin' }) {
  const { t, language } = useLanguage()
  const [kpis, setKpis] = useState<AdminKpisView | null>(null)
  // النطاق الافتراضي (آخر 7 أيام لين اليوم) "يتبع" التقويم: نحسبه من الوقت الحالي
  // كل مرة، فيتحرك مع تغيّر اليوم. لو المستخدم اختار تواريخ بيده نثبّتها كما هي
  const [now, setNow] = useState(() => new Date())
  const [reloadTick, setReloadTick] = useState(0)
  const [preset, setPreset] = useState<DateRangePreset>('week')
  const [manualRange, setManualRange] = useState<{ from: string; to: string } | null>(null)
  const range = manualRange ?? computeDateRangeForPreset(preset, now)
  const hasLoadedRef = useRef(false)
  const latestRequestRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const notifications = useAdminNotifications()
  const [breakdownView, setBreakdownView] = useState<'counselors' | 'countries'>('counselors')

  // كانت هالشاشة تعرض قيمة الدولة كما هي بقاعدة البيانات، فتبقى إنجليزي حتى
  // بالوضع العربي — نفس الحل المستخدم بشاشة الزيارات
  function countryLabel(value: string): string {
    return isKnownCountryScope(value) ? t('countries', COUNTRY_LABEL_KEYS[value]) : value
  }

  useEffect(() => {
    function refreshNow() {
      setNow(new Date())
      setReloadTick((tick) => tick + 1)
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') refreshNow()
    }
    const timer = window.setInterval(refreshNow, REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const rangeQuery = kuwaitRangeQuery(range)

  useEffect(() => {
    refreshKpis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeQuery?.from, rangeQuery?.to, reloadTick])

  async function refreshKpis() {
    // خانة تاريخ فاضية أو ناقصة — ما نرسل طلب، نظل نعرض آخر أرقام صالحة
    if (!rangeQuery) return
    const requestId = ++latestRequestRef.current
    const response = await fetch(
      `/api/admin/kpis?from=${encodeURIComponent(rangeQuery.from)}&to=${encodeURIComponent(rangeQuery.to)}`
    )
    // رد قديم وصل بعد طلب أحدث (تغيير سريع بالتواريخ) — نتجاهله
    if (requestId !== latestRequestRef.current) return
    if (!response.ok) {
      // فشل تحديث بالخلفية ما يمسح أرقام معروضة — الخطأ يظهر بس لو ما فيه أرقام أصلاً
      if (!hasLoadedRef.current) setError(t('admin', 'couldNotLoadKpis'))
      return
    }
    setError(null)
    hasLoadedRef.current = true
    setKpis(await response.json())
  }

  const redWaitingClients = notifications ? redClientCount(notifications) : 0

  function applyPreset(nextPreset: DateRangePreset) {
    setPreset(nextPreset)
    setManualRange(null)
    setNow(new Date())
  }

  if (error) return <p className="err">{error}</p>
  if (!kpis) return <p>{t('common', 'loading')}</p>

  const maxCountryCount = Math.max(1, ...kpis.countryBreakdown.map((c) => c.count))
  return (
    <div className="screen-dash">
      {/* ثلاثة بانرات بنفس الوزن كانت تدفع التواريخ والأرقام تحت الطية، وما
          تبان إلا بهالصفحة. صار سطر واحد يبان بالأحمر بس، والتفاصيل بالجرس
          اللي يمشي مع كل صفحات الأدمن */}
      {redWaitingClients > 0 && (
        <div className="slim-line">
          <span className="slim-dot" />
          <span>{t('admin', 'slimLineClients').replace('{count}', String(redWaitingClients))}</span>
          <button type="button" onClick={openNotificationsPanel}>
            {t('admin', 'slimLineOpen')} <span aria-hidden>&#8599;</span>
          </button>
        </div>
      )}
      <div className="date-range-row">
        <label>
          {t('admin', 'rangePresetLabel')}
          <select onChange={(e) => applyPreset(e.target.value as DateRangePreset)} defaultValue="">
            <option value="" disabled>
              {t('admin', 'rangePresetLabel')}
            </option>
            {DATE_RANGE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {t('admin', presetLabelKey(preset))}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('admin', 'dateFrom')}
          <input
            type="date"
            value={range.from}
            onChange={(e) => setManualRange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          {t('admin', 'dateTo')}
          <input
            type="date"
            value={range.to}
            onChange={(e) => setManualRange({ ...range, to: e.target.value })}
          />
        </label>
        <a
          href={
            rangeQuery
              ? `/api/admin/export?from=${encodeURIComponent(rangeQuery.from)}&to=${encodeURIComponent(rangeQuery.to)}`
              : undefined
          }
          className="export-btn date-range-export"
        >
          {t('admin', 'exportToExcel')}
        </a>
        <a href="/admin/qr-poster" target="_blank" rel="noreferrer" className="export-btn">
          {t('admin', 'viewQrCode')}
        </a>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="label">{t('admin', 'newClients')}</span>
          <span className="value">{kpis.totalByType.new}</span>
        </div>
        <div className="kpi-card">
          <span className="label">{t('admin', 'followUps')}</span>
          <span className="value">{kpis.totalByType.follow_up}</span>
        </div>
        <div className="kpi-card">
          <span className="label">{t('admin', 'visaOther')}</span>
          <span className="value">{kpis.totalByType.visa}</span>
        </div>
        <div className="kpi-card">
          <span className="label">{t('admin', 'closed')}</span>
          <span className="value">{kpis.funnel.closed}</span>
        </div>
      </div>

      <div className="kpi-row kpi-row-divider">
        <div className="kpi-card kpi-card-good">
          <span className="label">{t('admin', 'finishedWithin24h')}</span>
          <span className="value">{kpis.turnaround.within24h}</span>
        </div>
        <div className="kpi-card kpi-card-bad">
          <span className="label">{t('admin', 'finishedOver24h')}</span>
          <span className="value">{kpis.turnaround.over24h}</span>
        </div>
        <div className="kpi-card">
          <span className="label">{t('admin', 'stillInProgress')}</span>
          <span className="value">{kpis.turnaround.inProgress}</span>
        </div>
        <div className={`kpi-card ${kpis.followUpsDue.overdue > 0 ? 'kpi-card-bad' : ''}`}>
          <span className="label">{t('admin', 'followUpsDue')}</span>
          <span className="value">{kpis.followUpsDue.total}</span>
          {kpis.followUpsDue.overdue > 0 && (
            <span className="sub-value">
              {t('admin', 'followUpsOverdueCount').replace(
                '{count}',
                String(kpis.followUpsDue.overdue)
              )}
            </span>
          )}
        </div>
      </div>

      <section className="dash-panel">
        <div className="dash-panel-header">
          <div className="type-tabs">
            <button
              type="button"
              onClick={() => setBreakdownView('counselors')}
              className={breakdownView === 'counselors' ? 'active' : ''}
            >
              {t('admin', 'counselorPerformance')}
            </button>
            <button
              type="button"
              onClick={() => setBreakdownView('countries')}
              className={breakdownView === 'countries' ? 'active' : ''}
            >
              {t('admin', 'countryBreakdown')}
            </button>
          </div>
          {breakdownView === 'countries' && <span>{t('admin', 'countryBreakdownShare')}</span>}
        </div>

        <div className="dash-panel-content">
          {breakdownView === 'counselors' ? (
            <table>
              <thead>
                <tr>
                  <th>{t('admin', 'counselor')}</th>
                  <th>{t('admin', 'visits')}</th>
                  <th>{t('admin', 'closedHeader')}</th>
                  <th>{t('admin', 'applications')}</th>
                  <th>{t('admin', 'avgTime')}</th>
                  <th>{t('admin', 'status')}</th>
                  {role === 'super_admin' && <th>{t('admin', 'action')}</th>}
                </tr>
              </thead>
              <tbody>
                {kpis.counselorPerformance.map((c) => {
                  const isUnassigned = c.counselorId === UNASSIGNED_COUNSELOR_ID
                  const daysAbsent = workingDaysSinceLastSeen(
                    c.lastSeenAt ? new Date(c.lastSeenAt) : null,
                    new Date()
                  )
                  const status = backlogStatus(
                    c.counselorId,
                    c.visitCount,
                    c.closedCount,
                    daysAbsent
                  )
                  const name = isUnassigned
                    ? t('admin', 'unassignedCounselor')
                    : localizedName(c.counselorName, c.counselorNameAr, language)
                  // المعطّل يبقى بالجدول عشان زياراته السابقة، بس نميّزه بوضوح
                  // وما نعطي خيار إعادة تعيين لشخص ما يقدر يستلم شغل
                  const isDeactivated = !isUnassigned && !c.active
                  return (
                    <tr key={c.counselorId}>
                      <td data-label={t('admin', 'counselor')}>
                        <span className={isDeactivated ? 'counselor-deactivated' : undefined}>
                          {name}
                        </span>
                        {isDeactivated && (
                          <span className="pill inactive deactivated-tag">
                            {t('admin', 'deactivatedCounselor')}
                          </span>
                        )}
                      </td>
                      <td data-label={t('admin', 'visits')}>{c.visitCount}</td>
                      <td data-label={t('admin', 'closedHeader')}>{c.closedCount}</td>
                      <td data-label={t('admin', 'applications')}>{c.applicationCount}</td>
                      <td data-label={t('admin', 'avgTime')}>
                        {(() => {
                          const handling = handlingDisplay(
                            c,
                            t,
                            t('admin', 'minutesAbbrev'),
                            language
                          )
                          return (
                            <>
                              {handling.primary}
                              {handling.note && (
                                <span className="handling-note"> {handling.note}</span>
                              )}
                              {handling.badges.map((badge) => (
                                <span key={badge.key} className="pill watch handling-badge">
                                  {badge.text}
                                </span>
                              ))}
                            </>
                          )
                        })()}
                      </td>
                      <td data-label={t('admin', 'status')}>
                        <span
                          className={`pill ${
                            status === 'absent' &&
                            daysAbsent !== null &&
                            daysAbsent >= LONG_ABSENT_WORKING_DAYS
                              ? 'inactive'
                              : status
                          }`}
                        >
                          {status === 'absent'
                            ? t('admin', 'statusAbsent').replace('{days}', String(daysAbsent))
                            : t('admin', statusLabelKey(status))}
                        </span>
                      </td>
                      {role === 'super_admin' && (
                        <td className="cell-actions">
                          <a
                            className="view-visits-link"
                            href={`/admin/visits?counselor=${c.counselorId}`}
                          >
                            {t('admin', 'viewVisits')} <span className="dir-arrow">&#8599;</span>
                          </a>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="bars">
              {kpis.countryBreakdown.map((c) => (
                <div className="bar-row" key={c.country}>
                  <span className="country">{countryLabel(c.country)}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(c.count / maxCountryCount) * 100}%` }}
                    />
                  </div>
                  <span className="count">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
