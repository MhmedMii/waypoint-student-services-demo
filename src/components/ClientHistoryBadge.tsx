'use client'
import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { localizedName } from '../i18n/localizedName'
import type { Dictionary } from '../i18n/translations'
import type { Visit } from '../domain/entities/visit'
import type { Application, ServiceCode } from '../domain/entities/application'
import { KUWAIT_TIME_ZONE } from '../domain/time/kuwaitTime'
import { useDialog } from '../hooks/useDialog'

interface ClientHistoryEntry {
  source: 'visit' | 'application'
  id: string
  label: string
  visitType: Visit['type'] | null
  applicationKind: Application['kind'] | null
  serviceCode: string | null
  status: string
  counselorId: string | null
  counselorName: string | null
  counselorNameAr: string | null
  createdAt: string
  redacted?: boolean
}

function formatTimelineWhen(isoDate: string, language: string): string {
  return new Date(isoDate).toLocaleString(language, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: KUWAIT_TIME_ZONE,
  })
}

async function fetchClientHistory(phone: string): Promise<ClientHistoryEntry[]> {
  const response = await fetch(`/api/clients/history?phone=${encodeURIComponent(phone)}`)
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export interface ClientHistoryBadgeProps {
  phone: string
  count: number
  variant?: 'pill' | 'inline'
}

export function ClientHistoryBadge({ phone, count, variant = 'pill' }: ClientHistoryBadgeProps) {
  const { t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<ClientHistoryEntry[]>([])
  const { dialogProps, titleId } = useDialog({ open, onClose: () => setOpen(false) })

  if (count <= 1) return null

  // كانت label و status تجينا جمل إنجليزية جاهزة من السيرفر — الآن نبنيها هنا
  // من الكود الخام عشان تترجم بالعربي زي باقي الشاشات
  function entryLabel(entry: ClientHistoryEntry): string {
    if (entry.visitType) return t('visits', entry.visitType)
    if (entry.applicationKind) {
      const kindLabel = t(
        'visits',
        entry.applicationKind === 'visa' ? 'visaApplication' : 'examApplication'
      )
      const serviceLabel = entry.serviceCode ? t('apply', entry.serviceCode as ServiceCode) : ''
      return serviceLabel ? `${kindLabel} — ${serviceLabel}` : kindLabel
    }
    return entry.label
  }

  function entryStatusLabel(entry: ClientHistoryEntry): string {
    if (entry.source === 'visit') {
      return t('visits', entry.status === 'closed' ? 'statusClosed' : 'statusOpen')
    }
    return t('applications', entry.status as keyof Dictionary['applications'])
  }

  async function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(true)
    setLoading(true)
    setEntries(await fetchClientHistory(phone))
    setLoading(false)
  }

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className={variant === 'inline' ? 'c-inline-badge' : 'visit-badge'}
        onClick={handleOpen}
      >
        {t('visits', 'visitCount').replace('{count}', String(count))}
      </button>
      {open && (
        <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="confirm-modal-card hist-panel" {...dialogProps}>
            <p className="confirm-modal-title" id={titleId}>
              {t('visits', 'historyTitle')} — {phone}
            </p>
            {loading ? (
              <p className="confirm-modal-sub">{t('common', 'loading')}</p>
            ) : entries.length === 0 ? (
              <p className="confirm-modal-sub">{t('visits', 'historyEmpty')}</p>
            ) : (
              <div className="hist-list">
                {entries.map((entry) =>
                  // خارج نطاق المستشار: التاريخ فقط. نعرضه ولا نخفيه عشان
                  // العدد بالزر يوافق عدد السطور — الإخفاء يخلي الشارة تكذب
                  entry.redacted ? (
                    <div className="hist-row hist-row-redacted" key={`${entry.source}-${entry.id}`}>
                      <span className="hist-row-label">{t('visits', 'historyRedacted')}</span>
                      <span className="hist-row-when">
                        {formatTimelineWhen(entry.createdAt, language)}
                      </span>
                      <span className="hist-row-counselor">—</span>
                      <span className="pill">—</span>
                    </div>
                  ) : (
                    <div className="hist-row" key={`${entry.source}-${entry.id}`}>
                      <span className="hist-row-label">{entryLabel(entry)}</span>
                      <span className="hist-row-when">
                        {formatTimelineWhen(entry.createdAt, language)}
                      </span>
                      <span className="hist-row-counselor">
                        {entry.counselorId
                          ? localizedName(
                              entry.counselorName ?? entry.counselorId,
                              entry.counselorNameAr,
                              language
                            )
                          : t('visits', 'unassigned')}
                      </span>
                      <span className="pill watch">{entryStatusLabel(entry)}</span>
                    </div>
                  )
                )}
              </div>
            )}
            <div className="confirm-modal-actions">
              <button type="button" onClick={handleClose}>
                {t('visits', 'historyClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
