'use client'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useAdminNotifications, OPEN_NOTIFICATIONS_EVENT } from '../hooks/useAdminNotifications'
import type { TranslateFn } from '../app/admin/handlingBadges'
import {
  redItemCount,
  type AdminNotifications,
} from '../application/useCases/getAdminNotifications'

interface Item {
  key: string
  severity: 'red' | 'amber'
  text: string
  where: string
  href: string
}

// ما فيه "تجاهل" ولا "مقروء": السطر موجود لأنه صحيح الحين ويختفي بنفسه أول ما
// يصير غير صحيح، فزر تجاهل ما يقدر يسوي شي يشوفه أحد. الترتيب بالإلحاح:
// الأحمر (فيه عميل ينتظر) قبل البرتقالي (عادات)
export function notificationItems(view: AdminNotifications, t: TranslateFn): Item[] {
  const items: Item[] = []

  if (view.unassignedClients > 0) {
    items.push({
      key: 'unassigned',
      severity: 'red',
      text: t('admin', 'notifyUnassigned').replace('{count}', String(view.unassignedClients)),
      where: t('admin', 'notifyWhereUnassigned'),
      href: '/admin/visits?waiting=unassigned',
    })
  }
  if (view.clientsWaitingOnQuietCounselor > 0) {
    items.push({
      key: 'quiet',
      severity: 'red',
      text: t('admin', 'notifyWaitingOnQuiet').replace(
        '{count}',
        String(view.clientsWaitingOnQuietCounselor)
      ),
      where: t('admin', 'notifyWhereVisits'),
      href: '/admin/visits?waiting=quiet',
    })
  }
  // بدون هالسطر يطلع رقم الشريط النحيف (٨٦) من لا مكان: اللوحة تعدّ مستشارين
  // واللشريط يعدّ عملاء، فما تقدر تجمع اللي قدامك وتوصل للرقم
  if (view.clientsWaitingOnAbsentCounselor > 0) {
    items.push({
      key: 'stranded',
      severity: 'red',
      text: t('admin', 'notifyStrandedClients').replace(
        '{count}',
        String(view.clientsWaitingOnAbsentCounselor)
      ),
      where: t('admin', 'notifyWhereVisits'),
      href: '/admin/visits?waiting=absent',
    })
  }
  if (view.absentCounselorsWithClientsWaiting > 0) {
    items.push({
      key: 'absent',
      severity: 'red',
      text: t('admin', 'notifyAbsentWithWaiting').replace(
        '{count}',
        String(view.absentCounselorsWithClientsWaiting)
      ),
      where: t('admin', 'notifyWhereAccounts'),
      href: '/admin/accounts',
    })
  }
  if (view.instantCloseCount > 0 || view.leftOpenCount > 0) {
    items.push({
      key: 'handling',
      severity: 'amber',
      text: t('admin', 'notifyHandling')
        .replace('{instant}', String(view.instantCloseCount))
        .replace('{leftOpen}', String(view.leftOpenCount)),
      where: t('admin', 'notifyWhereSupervision'),
      href: '/admin/supervision',
    })
  }
  return items
}

export function NotificationsBell() {
  const { t } = useLanguage()
  const view = useAdminNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  // الشريط النحيف بالداشبورد يفتح نفس اللوحة. حدث على الويندو أبسط من كونتكست
  // لمكوّنين بفرعين مختلفين من الشجرة، وما يخلي الجرس يعرف شي عن الداشبورد
  useEffect(() => {
    function open() {
      setIsOpen(true)
    }
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, open)
    return () => window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, open)
  }, [])

  // كبسة برّا اللوحة تقفلها — بدونها تظل مفتوحة فوق الصفحة وتغطي الجدول
  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!anchorRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const items = view ? notificationItems(view, t) : []
  const redItems = view ? redItemCount(view) : 0
  const badge = items.length
  const tone = redItems > 0 ? 'red' : 'amber'

  return (
    <div className="bell-anchor" ref={anchorRef}>
      <button
        type="button"
        className={`bell ${isOpen ? 'open' : ''}`}
        aria-expanded={isOpen}
        aria-label={
          badge > 0
            ? t('admin', 'notifyBellWithCount').replace('{count}', String(badge))
            : t('admin', 'notifyBellClear')
        }
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
        </svg>
        {badge > 0 && <span className={`bell-count ${tone}`}>{badge}</span>}
      </button>

      {isOpen && (
        <div className="notify-panel">
          <div className="notify-panel-head">
            {t('admin', 'notifyTitle')}
            <span className="n">
              {badge > 0
                ? t('admin', 'notifyItemCount').replace('{count}', String(badge))
                : t('admin', 'notifyNothing')}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="notify-empty">{t('admin', 'notifyAllClear')}</p>
          ) : (
            items.map((item) => (
              <a key={item.key} className="notify-item" href={item.href}>
                <span className={`notify-sev ${item.severity}`} />
                <span className="notify-text">
                  <span className="notify-title">{item.text}</span>
                  <span className="notify-where">{item.where}</span>
                </span>
                <span className="notify-go" aria-hidden>
                  &#8599;
                </span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  )
}
