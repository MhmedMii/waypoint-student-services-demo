'use client'
import { Fragment, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { localizedName } from '../../i18n/localizedName'
import { OnlineSessionDetail } from './OnlineSessionDetail'
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
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000))
}

function PresenceTable({
  rows,
  selected,
  onSelect,
}: {
  rows: PresenceRow[]
  selected: PresenceRow | null
  onSelect: (row: PresenceRow | null) => void
}) {
  const { t, language } = useLanguage()
  return (
    <div className="table-wrap">
      <table className="presence-table">
        <colgroup>
          <col style={{ width: '40%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '24%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>{t('admin', 'counselor')}</th>
            <th>{t('admin', 'status')}</th>
            <th>{t('admin', 'onlineTodayHeader')}</th>
            <th>{t('admin', 'lastSeenHeader')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const isSelected = selected?.id === p.id
            const displayName = localizedName(p.name, p.nameAr, language)
            return (
              <Fragment key={p.id}>
                <tr className="history-row" onClick={() => onSelect(isSelected ? null : p)}>
                  <td>
                    <div className="flat-row-name">
                      <div className="avatar">{initials(displayName)}</div>
                      {/* الصف نفسه يفتح ويسكّر بالماوس. stopPropagation عشان الضغطة
                          تنعالج مرة وحدة بس — بدونه الصف يعيد نفس الطلب (نفس الحالة
                          القديمة بالنداءين، فالنتيجة ما تتغير)، بس مرة وحدة أوضح */}
                      <button
                        type="button"
                        className="row-open-button"
                        aria-expanded={isSelected}
                        aria-controls={`session-detail-${p.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(isSelected ? null : p)
                        }}
                      >
                        {displayName}
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${p.isOnline ? 'active' : 'offline'}`}>
                      {p.isOnline ? t('admin', 'online') : t('admin', 'offline')}
                    </span>
                  </td>
                  <td>{formatDurationHMS(p.onlineSecondsToday, language)}</td>
                  <td>
                    {p.isOnline
                      ? '—'
                      : p.lastSeenAt
                        ? formatLastSeenAgo(secondsSince(p.lastSeenAt), language)
                        : t('admin', 'lastSeenNever')}
                  </td>
                </tr>
                {isSelected && (
                  <tr className="presence-expand-row" id={`session-detail-${p.id}`}>
                    <td colSpan={4}>
                      <OnlineSessionDetail
                        userId={p.id}
                        name={p.name}
                        nameAr={p.nameAr}
                        onClose={() => onSelect(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function CounselorOnlineHistory({ role }: { role: 'admin' | 'super_admin' }) {
  const { t } = useLanguage()
  const [presence, setPresence] = useState<PresenceRow[]>([])
  const [selected, setSelected] = useState<PresenceRow | null>(null)

  useVisiblePolling(() => {
    fetchPresence().then(setPresence)
  }, POLL_INTERVAL_MS)

  const counselors = presence.filter((p) => p.role === 'counselor')
  const admins = presence.filter((p) => p.role === 'admin' || p.role === 'super_admin')

  return (
    <>
      <section className="dash-panel">
        <h3>{t('admin', 'onlineHistoryTitle')}</h3>
        <PresenceTable rows={counselors} selected={selected} onSelect={setSelected} />
      </section>
      {role === 'super_admin' && (
        <section className="dash-panel">
          <h3>{t('admin', 'onlineHistoryAdminsTitle')}</h3>
          <PresenceTable rows={admins} selected={selected} onSelect={setSelected} />
        </section>
      )}
    </>
  )
}
