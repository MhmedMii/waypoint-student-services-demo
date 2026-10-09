'use client'
import { useState } from 'react'
import { useLanguage } from '../../../i18n/LanguageContext'
import { localizedName } from '../../../i18n/localizedName'
import type { Dictionary } from '../../../i18n/translations'
import { formatDurationHMS } from '../../../domain/time/formatDurationHMS'
import { useVisiblePolling } from '../../../hooks/useVisiblePolling'
import { formatShortDuration } from '../handlingBadges'

const POLL_INTERVAL_MS = 20 * 1000
// طلب ما يرد أبدًا كان يخلي الشاشة عالقة على "جارٍ التحميل" للأبد. بعد هالمدة
// نعتبره فاشل ونعطي المشرف زر إعادة محاولة بدل انتظار ما ينتهي
const REQUEST_TIMEOUT_MS = 10 * 1000

type SupervisionStatus = 'in_session' | 'on_break' | 'idle' | 'away' | 'offline'

interface SupervisionRow {
  id: string
  name: string
  nameAr: string | null
  isOnline: boolean
  onlineSecondsToday: number
  status: SupervisionStatus
  currentSince: string | null
  lastSeenAt: string | null
  closedToday: number
  avgHandlingMs: number | null
  instantCloseCount: number
  instantCloseAvgMs: number | null
  leftOpenCount: number
  leftOpenAvgMs: number | null
  breakMsToday: number
}

// كانت ترجّع [] لأي فشل — فصفحة الإشراف تقول "ما فيه مستشارين" سواء انتهت
// الجلسة، أو طاح السيرفر، أو فعلاً ما فيه أحد. نفرّق بينهم عشان المشرف يعرف
// وش صار ويتصرف
type SupervisionFetchResult =
  | { ok: true; rows: SupervisionRow[] }
  | { ok: false; reason: 'unauthorized' | 'failed' | 'timeout' }

async function fetchSupervision(): Promise<SupervisionFetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch('/api/admin/supervision', { signal: controller.signal })
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: 'unauthorized' }
    }
    if (!response.ok) return { ok: false, reason: 'failed' }
    const data = await response.json()
    if (!Array.isArray(data)) return { ok: false, reason: 'failed' }
    return { ok: true, rows: data }
  } catch {
    return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'failed' }
  } finally {
    clearTimeout(timer)
  }
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function elapsedSince(iso: string): number {
  return Math.max(0, Date.now() - new Date(iso).getTime())
}

const STATUS_ORDER: SupervisionStatus[] = ['in_session', 'on_break', 'idle', 'away', 'offline']
// لو جا وضع ما نعرفه (نسخة سيرفر أحدث مثلاً) نعرضه تحت "أخرى" بدل ما يختفي
// الصف بصمت ونطلع بلوحة فاضية وفيها بيانات فعلاً
const OTHER_GROUP = 'other'
const STATUS_DOT_CLASS: Record<SupervisionStatus, string> = {
  in_session: 'online',
  on_break: 'break',
  idle: 'idle',
  away: 'away',
  offline: 'offline',
}
const STATUS_GROUP_LABEL_KEY: Record<
  SupervisionStatus,
  'withStudent' | 'onBreak' | 'idle' | 'away' | 'offline'
> = {
  in_session: 'withStudent',
  on_break: 'onBreak',
  idle: 'idle',
  away: 'away',
  offline: 'offline',
}

function statusDetail(
  row: SupervisionRow,
  t: (section: 'supervision', key: keyof Dictionary['supervision']) => string,
  language: 'en' | 'ar'
): string {
  if (row.status === 'in_session' && row.currentSince) {
    return `${t('supervision', 'withStudent')} — ${formatDurationHMS(Math.floor(elapsedSince(row.currentSince) / 1000), language)}`
  }
  if (row.status === 'on_break' && row.currentSince) {
    return `${t('supervision', 'onBreak')} — ${formatDurationHMS(Math.floor(elapsedSince(row.currentSince) / 1000), language)}`
  }
  if (row.status === 'away' && row.lastSeenAt) {
    return `${t('supervision', 'away')} — ${formatDurationHMS(Math.floor(elapsedSince(row.lastSeenAt) / 1000), language)}`
  }
  return t('supervision', row.status === 'idle' ? 'idle' : 'offline')
}

export function SupervisionPanel() {
  const { t, language } = useLanguage()
  // rows = null يعني "ما وصلنا رد صالح بعد" — مختلف تمامًا عن [] يعني "ما فيه أحد"
  const [rows, setRows] = useState<SupervisionRow[] | null>(null)
  const [failure, setFailure] = useState<'unauthorized' | 'failed' | 'timeout' | null>(null)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  const [, setTick] = useState(0)

  async function load() {
    try {
      const result = await fetchSupervision()
      if (result.ok) {
        setRows(result.rows)
        setFailure(null)
        setLoadedAt(Date.now())
        return
      }
      // فشل تحديث واللوحة معروضة: نخلي الأرقام مكانها مع ملاحظة إنها مو طازجة،
      // بدل ما نمسح شاشة إشراف شغالة
      setFailure(result.reason)
    } catch {
      // أي خطأ غير متوقع لازم ينتهي بحالة واضحة — ما نترك الشاشة معلّقة
      setFailure('failed')
    }
  }

  useVisiblePolling(() => {
    void load()
  }, POLL_INTERVAL_MS)

  // عدّاد العرض بس — بدون شبكة — فيوقف هو بعد وقت التبويب مخفي بنفس المنطق
  useVisiblePolling(() => setTick((n) => n + 1), 1000)

  const loadedRows = rows ?? []
  const groups = [...STATUS_ORDER, OTHER_GROUP]
    .map((status) => ({
      status,
      rows:
        status === OTHER_GROUP
          ? loadedRows.filter((r) => !STATUS_ORDER.includes(r.status))
          : loadedRows.filter((r) => r.status === status),
    }))
    .filter((g) => g.rows.length > 0)

  const staleSeconds = loadedAt === null ? 0 : Math.floor((Date.now() - loadedAt) / 1000)

  return (
    <div className="accounts-panel">
      <h3>{t('supervision', 'title')}</h3>
      {rows === null && failure === null ? (
        <p className="students-empty">{t('supervision', 'loading')}</p>
      ) : failure === 'unauthorized' ? (
        <div className="supervision-state">
          <b>{t('supervision', 'sessionEnded')}</b>
          <p>{t('supervision', 'sessionEndedHint')}</p>
          <a className="btn-orange" href="/login">
            {t('supervision', 'signIn')}
          </a>
        </div>
      ) : rows === null ? (
        <div className="supervision-state">
          <b>{t('supervision', 'loadFailed')}</b>
          <p>{t('supervision', failure === 'timeout' ? 'loadTimedOutHint' : 'loadFailedHint')}</p>
          <button type="button" className="btn-orange" onClick={() => void load()}>
            {t('supervision', 'retry')}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="supervision-state">
          <b>{t('supervision', 'empty')}</b>
          <p>{t('supervision', 'emptyHint')}</p>
          <a className="btn-orange" href="/admin/accounts">
            {t('supervision', 'openAccounts')}
          </a>
        </div>
      ) : (
        <>
          {failure !== null && loadedAt !== null && (
            <p className="supervision-stale" role="status">
              ⚠{' '}
              {t('supervision', 'staleNotice').replace(
                '{ago}',
                formatDurationHMS(staleSeconds, language)
              )}
            </p>
          )}
          {groups.map((group) => (
            <div key={group.status}>
              <div className="group-label">
                <span
                  className={`status-dot ${STATUS_DOT_CLASS[group.status as SupervisionStatus] ?? 'offline'}`}
                />
                {group.status === OTHER_GROUP
                  ? t('supervision', 'other')
                  : t(
                      'supervision',
                      STATUS_GROUP_LABEL_KEY[group.status as SupervisionStatus]
                    )}{' '}
                &middot; {group.rows.length}
              </div>
              <div className="group-list">
                {group.rows.map((r) => {
                  const displayName = localizedName(r.name, r.nameAr, language)
                  return (
                    <div className="group-row" key={r.id}>
                      <div className="avatar">{initials(displayName)}</div>
                      <div className="group-row-main">
                        <div className="g-name">{displayName}</div>
                        <div className={`g-status ${r.status}`}>{statusDetail(r, t, language)}</div>
                      </div>
                      <div className="sup-inline-metrics">
                        {r.closedToday} {t('supervision', 'closedToday')} &middot;{' '}
                        <b>
                          {r.avgHandlingMs !== null
                            ? formatShortDuration(r.avgHandlingMs, language)
                            : '—'}
                        </b>{' '}
                        {t('supervision', 'avgHandling')}
                        {r.avgHandlingMs !== null &&
                          r.closedToday - r.instantCloseCount - r.leftOpenCount === 1 && (
                            <span className="handling-note">
                              {' '}
                              {t('admin', 'handlingSingleSampleNote')}
                            </span>
                          )}{' '}
                        &middot;{' '}
                        {/* هالعدّاد يحسب اليوم فقط، بينما بانر لوحة الـKPI يحسب
                            النطاق المختار — بدون كلمة "today" الرقمان يبيّنون
                            متناقضين وهما صح الاثنين */}
                        {r.instantCloseCount > 0 ? (
                          <span className="pill instant handling-badge">
                            {t('supervision', 'instantToday').replace(
                              '{count}',
                              String(r.instantCloseCount)
                            )}
                          </span>
                        ) : (
                          <span className="dim">
                            {t('supervision', 'instantToday').replace('{count}', '—')}
                          </span>
                        )}{' '}
                        &middot;{' '}
                        {r.leftOpenCount > 0 && (
                          <>
                            <span className="pill watch handling-badge">
                              {t('admin', 'leftOpenBadge').replace(
                                '{count}',
                                String(r.leftOpenCount)
                              )}
                            </span>{' '}
                            &middot;{' '}
                          </>
                        )}
                        {r.breakMsToday > 0
                          ? formatDurationHMS(Math.floor(r.breakMsToday / 1000), language)
                          : '—'}{' '}
                        {t('supervision', 'breakToday')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
