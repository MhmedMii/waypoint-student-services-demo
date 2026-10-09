'use client'
import { useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { localizedName } from '../../i18n/localizedName'
import type { Language } from '../../i18n/translations'
import { formatDurationHMS } from '../../domain/time/formatDurationHMS'
import { formatLastSeenAgo } from '../../domain/time/formatLastSeenAgo'
import { useVisiblePolling } from '../../hooks/useVisiblePolling'

const POLL_INTERVAL_MS = 20 * 1000

interface PresenceRow {
  id: string
  name: string
  nameAr: string | null
  role: 'super_admin' | 'admin' | 'counselor'
  isOnline: boolean
  lastSeenAt: string | null
  onlineSecondsToday: number
}

async function fetchPresence(): Promise<PresenceRow[]> {
  const response = await fetch('/api/admin/online')
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function secondsSince(isoDate: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 1000))
}

// نقسّم الموظفين لثلاث مجموعات — أونلاين الحين، غايبين بس شغّالين اليوم،
// وما نشطوا اليوم إطلاقاً — بدل قايمة أبجدية واحدة يصعب تفحّصها بسرعة
function groupPresence(rows: PresenceRow[]) {
  const online = rows.filter((r) => r.isOnline)
  const away = rows.filter((r) => !r.isOnline && r.onlineSecondsToday > 0)
  const idle = rows.filter((r) => !r.isOnline && r.onlineSecondsToday === 0)
  return { online, away, idle }
}

function TotalOnlineTodayPill({
  t,
  language,
  seconds,
}: {
  t: ReturnType<typeof useLanguage>['t']
  language: Language
  seconds: number
}) {
  return (
    <span className="presence-pill">
      <span className="presence-caption">{t('admin', 'totalOnlineToday')}</span>
      <span className="val">{formatDurationHMS(seconds, language)}</span>
    </span>
  )
}

function PresenceRowView({
  t,
  language,
  row,
}: {
  t: ReturnType<typeof useLanguage>['t']
  language: Language
  row: PresenceRow
}) {
  const displayName = localizedName(row.name, row.nameAr, language)
  return (
    <div className="presence-row">
      <div className="avatar">{initials(displayName)}</div>
      <div className="presence-who">
        <div className="user-name">{displayName}</div>
        <div className="user-role">{t('nav', row.role)}</div>
      </div>
      {row.onlineSecondsToday === 0 ? (
        <div className="presence-idle-note">
          {row.lastSeenAt
            ? `${t('admin', 'lastSeenPrefix')} ${formatLastSeenAgo(secondsSince(row.lastSeenAt), language)}`
            : t('admin', 'lastSeenNever')}
        </div>
      ) : (
        <div className="presence-stat">
          <div className="presence-status-block">
            <div className="presence-caption">{t('admin', 'currentStatus')}</div>
            <div className={`presence-primary ${row.isOnline ? 'online' : ''}`}>
              {row.isOnline
                ? t('admin', 'online')
                : `${t('admin', 'awaySincePrefix')} ${row.lastSeenAt ? formatDurationHMS(secondsSince(row.lastSeenAt), language) : ''}`}
            </div>
          </div>
          <TotalOnlineTodayPill t={t} language={language} seconds={row.onlineSecondsToday} />
        </div>
      )}
    </div>
  )
}

function PresenceGroup({
  t,
  language,
  dotClass,
  titleKey,
  subKey,
  rows,
}: {
  t: ReturnType<typeof useLanguage>['t']
  language: Language
  dotClass: string
  titleKey: 'presenceGroupOnline' | 'presenceGroupAway' | 'presenceGroupIdle'
  subKey?: 'presenceGroupAwaySub' | 'presenceGroupIdleSub'
  rows: PresenceRow[]
}) {
  if (rows.length === 0) return null
  return (
    <section className="presence-group">
      <div className="presence-group-head">
        <span className={`status-dot ${dotClass}`} />
        <span className="presence-group-title">{t('admin', titleKey)}</span>
        <span className="presence-group-count">{rows.length}</span>
        {subKey && <span className="presence-group-sub">— {t('admin', subKey)}</span>}
      </div>
      <div className="presence-panel">
        {rows.map((row) => (
          <PresenceRowView key={row.id} t={t} language={language} row={row} />
        ))}
      </div>
    </section>
  )
}

export function OnlineNowPanel() {
  const { t, language } = useLanguage()
  const [presence, setPresence] = useState<PresenceRow[]>([])

  useVisiblePolling(() => {
    fetchPresence().then(setPresence)
  }, POLL_INTERVAL_MS)

  const { online, away, idle } = groupPresence(presence)

  return (
    <section className="dash-panel">
      <div className="presence-head">
        <div>
          <h1>{t('admin', 'onlineNow')}</h1>
          <p>{t('admin', 'onlineNowSubtitle')}</p>
        </div>
        <span className="presence-live">
          <span className="pulse" />
          20s
        </span>
      </div>

      <div className="presence-summary">
        <div className="kpi-card online">
          <span className="label">{t('admin', 'presenceSummaryOnline')}</span>
          <span className="value">{online.length}</span>
        </div>
        <div className="kpi-card away">
          <span className="label">{t('admin', 'presenceSummaryAway')}</span>
          <span className="value">{away.length}</span>
        </div>
        <div className="kpi-card idle">
          <span className="label">{t('admin', 'presenceSummaryIdle')}</span>
          <span className="value">{idle.length}</span>
        </div>
        <div className="kpi-card">
          <span className="label">{t('admin', 'presenceSummaryTotal')}</span>
          <span className="value">{presence.length}</span>
        </div>
      </div>

      <PresenceGroup
        t={t}
        language={language}
        dotClass="online"
        titleKey="presenceGroupOnline"
        rows={online}
      />
      <PresenceGroup
        t={t}
        language={language}
        dotClass="break"
        titleKey="presenceGroupAway"
        subKey="presenceGroupAwaySub"
        rows={away}
      />
      <PresenceGroup
        t={t}
        language={language}
        dotClass="offline"
        titleKey="presenceGroupIdle"
        subKey="presenceGroupIdleSub"
        rows={idle}
      />
    </section>
  )
}
