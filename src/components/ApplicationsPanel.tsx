'use client'
import { Fragment, useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { localizedName } from '../i18n/localizedName'
import { translateErrorCode } from '../i18n/translateErrorCode'
import { computeApplicationTurnaround } from '../domain/time/computeApplicationTurnaround'
import { formatTurnaround } from '../domain/time/formatTurnaround'
import { ApplicationProfileModal } from './ApplicationProfileModal'
import { TablePagingBar, TablePager } from './TablePaging'
import { useTablePaging } from '../hooks/useTablePaging'
import { matchesClientSearch } from '../domain/text/matchesClientSearch'
import type {
  ApplicationKind,
  ApplicationStatus,
  ServiceCode,
} from '../domain/entities/application'
import { KUWAIT_TIME_ZONE } from '../domain/time/kuwaitTime'

const TURNAROUND_PILL_CLASS: Record<string, string> = {
  within24h: 'on-track',
  over24h: 'inactive',
  in_progress: 'watch',
}

const STATUS_OPTIONS: ApplicationStatus[] = [
  'pending',
  'under_review',
  'documents_requested',
  'submitted_to_source',
  'approved',
  'rejected',
]

export const STATUS_PILL_CLASS: Record<ApplicationStatus, string> = {
  pending: 'offline',
  under_review: 'watch',
  documents_requested: 'watch',
  submitted_to_source: 'watch',
  approved: 'on-track',
  rejected: 'inactive',
}

export interface ApplicationRow {
  id: string
  applicationNumber: string
  kind: ApplicationKind
  name: string
  phone: string
  serviceCode: string
  status: ApplicationStatus
  statusNote: string | null
  referenceNumber: string | null
  counselorId: string | null
  paymentUrl: string | null
  acceptedAt: string | null
  closedAt: string | null
  fields: Record<string, string>
  missingDocuments?: string[]
  requiredDocumentCount?: number
  uploadedRequiredCount?: number
  createdAt: string
  updatedAt: string
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

export interface CounselorOption {
  id: string
  name: string
  nameAr: string | null
}

async function fetchApplications(kind: ApplicationKind): Promise<ApplicationRow[]> {
  const response = await fetch(`/api/applications/kind/${kind}`)
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

async function fetchActiveCounselors(): Promise<CounselorOption[]> {
  const response = await fetch('/api/counselors/active')
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export function ApplicationsPanel({ kind }: { kind: ApplicationKind }) {
  const { t, language } = useLanguage()
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [pendingStatus, setPendingStatus] = useState<Record<string, ApplicationStatus>>({})
  const [pendingNote, setPendingNote] = useState<Record<string, string>>({})
  const [pendingRef, setPendingRef] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // كل الطلبات محمّلة أصلاً (ما فيه حد تواريخ بهالصفحة)، فالبحث محلي وفوري
  const shownApplications = applications.filter((application) =>
    matchesClientSearch(
      [application.name, application.phone, application.applicationNumber],
      search
    )
  )
  const paging = useTablePaging(shownApplications, `applications-${kind}-page-size`)
  const [editingStatusFor, setEditingStatusFor] = useState<string | null>(null)
  const [editingAssignFor, setEditingAssignFor] = useState<string | null>(null)
  const [viewingProfileFor, setViewingProfileFor] = useState<string | null>(null)
  const [pendingCounselor, setPendingCounselor] = useState<Record<string, string>>({})
  const [counselors, setCounselors] = useState<CounselorOption[]>([])

  useEffect(() => {
    refresh()
    fetchActiveCounselors().then(setCounselors)
  }, [kind])

  async function refresh() {
    setApplications(await fetchApplications(kind))
  }

  function handleToggleStatusEditor(applicationId: string) {
    setEditingStatusFor(editingStatusFor === applicationId ? null : applicationId)
  }

  function handleToggleAssignEditor(applicationId: string) {
    setEditingAssignFor(editingAssignFor === applicationId ? null : applicationId)
  }

  async function handleSaveAssign(applicationId: string, currentCounselorId: string | null) {
    setError(null)
    const counselorId = pendingCounselor[applicationId] ?? currentCounselorId ?? ''
    try {
      const response = await fetch(`/api/applications/kind/${kind}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, counselorId: counselorId || null }),
      })
      const result = await response.json()
      if (!result.ok) {
        setError(
          translateErrorCode(language, result.reason) ??
            t('applications', 'couldNotAssignCounselor')
        )
        return
      }

      const { [applicationId]: _c, ...restCounselor } = pendingCounselor
      setPendingCounselor(restCounselor)
      setEditingAssignFor(null)

      await refresh()
    } catch {
      setError(t('applications', 'couldNotAssignCounselor'))
    }
  }

  async function handleSaveStatus(applicationId: string) {
    setError(null)
    const status = pendingStatus[applicationId]
    if (!status) return
    try {
      const response = await fetch(`/api/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          statusNote: pendingNote[applicationId] ?? null,
          referenceNumber: pendingRef[applicationId] ?? null,
        }),
      })
      const result = await response.json()
      if (!result.ok) {
        const params =
          result.reason === 'invalidStatusTransition'
            ? { from: t('applications', result.from), to: t('applications', result.to) }
            : undefined
        setError(
          translateErrorCode(language, result.reason, params) ??
            t('applications', 'couldNotUpdateStatus')
        )
        return
      }

      const { [applicationId]: _s, ...restStatus } = pendingStatus
      const { [applicationId]: _n, ...restNote } = pendingNote
      const { [applicationId]: _r, ...restRef } = pendingRef
      setPendingStatus(restStatus)
      setPendingNote(restNote)
      setPendingRef(restRef)
      setEditingStatusFor(null)

      await refresh()
    } catch {
      setError(t('applications', 'couldNotUpdateStatus'))
    }
  }

  return (
    <div className="accounts-panel">
      <div className="date-range-row">
        <h3>{t('applications', kind === 'visa' ? 'visasTitle' : 'examsTitle')}</h3>
        <div className="applications-panel-actions date-range-export">
          <a href={`/api/applications/export?kind=${kind}&lang=${language}`} className="export-btn">
            {t('applications', 'export')}
          </a>
          <a href="/apply/qr-poster" target="_blank" rel="noreferrer" className="export-btn">
            {t('applications', 'viewQrCode')}
          </a>
        </div>
      </div>
      {error && <p className="err">{error}</p>}

      <div className="visits-filter-row">
        <label className="visits-search">
          {t('applications', 'searchLabel')}
          <span className="visits-search-box">
            <input
              type="text"
              value={search}
              placeholder={t('applications', 'searchPlaceholder')}
              onChange={(e) => {
                setSearch(e.target.value)
                paging.resetToFirstPage()
              }}
            />
            {search && (
              <button
                type="button"
                aria-label={t('applications', 'searchClear')}
                onClick={() => {
                  setSearch('')
                  paging.resetToFirstPage()
                }}
              >
                ✕
              </button>
            )}
          </span>
        </label>
      </div>
      <TablePagingBar
        slice={paging.slice}
        pageSize={paging.pageSize}
        onPageSizeChange={paging.setPageSize}
        summary={
          search.trim()
            ? t('applications', 'searchMatches')
                .replace('{count}', String(paging.slice.total))
                .replace('{total}', String(applications.length))
                .replace('{term}', search.trim())
            : undefined
        }
      />
      <div className="table-wrap">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>{t('applications', 'appNo')}</th>
              <th>{t('applications', 'name')}</th>
              <th>{t('applications', 'phone')}</th>
              <th>{t('applications', 'service')}</th>
              <th>{t('applications', 'status')}</th>
              <th>{t('applications', 'documents')}</th>
              <th>{t('applications', 'turnaround')}</th>
              <th>{t('applications', 'referenceNo')}</th>
              <th>{t('applications', 'timeline')}</th>
              <th>{t('applications', 'actions')}</th>
            </tr>
          </thead>
          <tbody>
            {paging.slice.rows.map((application) => (
              <Fragment key={application.id}>
                <tr
                  className="app-row-clickable"
                  onClick={() => setViewingProfileFor(application.id)}
                >
                  <td data-label={t('applications', 'appNo')}>{application.applicationNumber}</td>
                  <td data-label={t('applications', 'name')}>
                    {/* زر حقيقي على الاسم: الصف ما ينوصل بالكيبورد. role="button" على
                        الـ<tr> نفسه كان يكسر الجدول لقارئ الشاشة (الصف يصير زر طويل
                        وتضيع الأعمدة)، فالصف يظل صف ويظل ينضغط بالماوس */}
                    <button
                      type="button"
                      className="row-open-button"
                      aria-haspopup="dialog"
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingProfileFor(application.id)
                      }}
                    >
                      {application.name}
                    </button>
                  </td>
                  <td data-label={t('applications', 'phone')}>{application.phone}</td>
                  <td data-label={t('applications', 'service')} className="svc-caps">
                    {t('apply', application.serviceCode as ServiceCode)}
                  </td>
                  <td data-label={t('applications', 'status')}>
                    <span className={`pill ${STATUS_PILL_CLASS[application.status]}`}>
                      {t('applications', application.status)}
                    </span>
                  </td>
                  <td data-label={t('applications', 'documents')}>
                    {(application.requiredDocumentCount ?? 0) === 0 ? (
                      <span className="dim">—</span>
                    ) : (application.missingDocuments?.length ?? 0) > 0 ? (
                      <span
                        className="pill inactive"
                        title={t('applications', 'missingDocuments').replace(
                          '{labels}',
                          (application.missingDocuments ?? []).join(', ')
                        )}
                      >
                        {t('applications', 'documentsMissingCount').replace(
                          '{count}',
                          String(application.missingDocuments?.length ?? 0)
                        )}
                      </span>
                    ) : (
                      <span className="pill on-track">
                        {t('applications', 'documentsComplete')
                          .replace('{count}', String(application.uploadedRequiredCount ?? 0))
                          .replace('{total}', String(application.requiredDocumentCount ?? 0))}
                      </span>
                    )}
                  </td>
                  <td data-label={t('applications', 'turnaround')}>
                    {(() => {
                      const turnaround = computeApplicationTurnaround(
                        {
                          status: application.status,
                          createdAt: new Date(application.createdAt),
                          updatedAt: new Date(application.updatedAt),
                        },
                        new Date()
                      )
                      const elapsed = formatTurnaround(turnaround.hours)
                      return (
                        <span className={`pill ${TURNAROUND_PILL_CLASS[turnaround.status]}`}>
                          {t('applications', turnaround.status)} · {elapsed.value}
                          {t(
                            'applications',
                            elapsed.unit === 'days' ? 'daysAbbrev' : 'hoursAbbrev'
                          )}
                        </span>
                      )
                    })()}
                  </td>
                  <td data-label={t('applications', 'referenceNo')}>
                    {application.referenceNumber ?? '—'}
                  </td>
                  <td data-label={t('applications', 'timeline')}>
                    <div className="mini-timeline">
                      <div className="mini-timeline-step done">
                        <span className="mini-timeline-dot" />
                        <span className="mini-timeline-label">
                          {t('applications', 'timelineSubmitted')}
                        </span>
                        <span className="mini-timeline-when">
                          {formatTimelineWhen(application.createdAt, language)}
                        </span>
                      </div>
                      <div
                        className={`mini-timeline-step ${application.acceptedAt ? 'done' : 'pending'}`}
                      >
                        <span className="mini-timeline-dot" />
                        <span className="mini-timeline-label">
                          {t('applications', 'timelineAccepted')}
                        </span>
                        <span className="mini-timeline-when">
                          {application.acceptedAt
                            ? formatTimelineWhen(application.acceptedAt, language)
                            : t('applications', 'timelineNotYet')}
                        </span>
                      </div>
                      <div
                        className={`mini-timeline-step ${application.closedAt ? 'done' : 'pending'}`}
                      >
                        <span className="mini-timeline-dot" />
                        <span className="mini-timeline-label">
                          {t('applications', 'timelineClosed')}
                        </span>
                        <span className="mini-timeline-when">
                          {application.closedAt
                            ? formatTimelineWhen(application.closedAt, language)
                            : t('applications', 'timelineNotYet')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td
                    className="cell-actions applications-actions-cell"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="applications-actions-wrap">
                      <button
                        type="button"
                        className="btn-orange"
                        onClick={() => handleToggleStatusEditor(application.id)}
                      >
                        {editingStatusFor === application.id
                          ? t('applications', 'cancel')
                          : t('applications', 'updateStatus')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAssignEditor(application.id)}
                      >
                        {editingAssignFor === application.id
                          ? t('applications', 'cancel')
                          : t('applications', 'assign')}
                      </button>
                    </div>
                  </td>
                </tr>
                {editingAssignFor === application.id && (
                  <tr className="inline-password-row">
                    <td colSpan={10} className="cell-full">
                      <div className="applications-status-editor">
                        <label>
                          <span>{t('applications', 'counselor')}</span>
                          <select
                            value={
                              pendingCounselor[application.id] ?? application.counselorId ?? ''
                            }
                            onChange={(e) =>
                              setPendingCounselor({
                                ...pendingCounselor,
                                [application.id]: e.target.value,
                              })
                            }
                          >
                            <option value="">{t('applications', 'unassigned')}</option>
                            {counselors.map((c) => (
                              <option key={c.id} value={c.id}>
                                {localizedName(c.name, c.nameAr, language)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="applications-status-editor-actions">
                          <button
                            type="button"
                            className="btn-orange"
                            onClick={() =>
                              handleSaveAssign(application.id, application.counselorId)
                            }
                          >
                            {t('applications', 'saveAssign')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAssignEditor(application.id)}
                          >
                            {t('applications', 'cancel')}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {editingStatusFor === application.id && (
                  <tr className="inline-password-row">
                    <td colSpan={10} className="cell-full">
                      <div className="applications-status-editor">
                        <label>
                          <span>{t('applications', 'status')}</span>
                          <select
                            value={pendingStatus[application.id] ?? application.status}
                            onChange={(e) =>
                              setPendingStatus({
                                ...pendingStatus,
                                [application.id]: e.target.value as ApplicationStatus,
                              })
                            }
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {t('applications', status)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>{t('applications', 'statusNote')}</span>
                          <input
                            placeholder={t('applications', 'statusNotePlaceholder')}
                            value={pendingNote[application.id] ?? application.statusNote ?? ''}
                            onChange={(e) =>
                              setPendingNote({ ...pendingNote, [application.id]: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          <span>{t('applications', 'referenceNo')}</span>
                          <input
                            placeholder={t('applications', 'referenceNoPlaceholder')}
                            value={pendingRef[application.id] ?? application.referenceNumber ?? ''}
                            onChange={(e) =>
                              setPendingRef({ ...pendingRef, [application.id]: e.target.value })
                            }
                          />
                        </label>
                        <div className="applications-status-editor-actions">
                          <button
                            type="button"
                            className="btn-orange"
                            onClick={() => handleSaveStatus(application.id)}
                          >
                            {t('applications', 'saveStatus')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatusEditor(application.id)}
                          >
                            {t('applications', 'cancel')}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {search.trim() && paging.slice.total === 0 && (
        <p className="visits-search-empty">
          {t('applications', 'searchNoMatch').replace('{term}', search.trim())}
        </p>
      )}
      <TablePager slice={paging.slice} onPage={paging.setPage} />

      {viewingProfileFor &&
        (() => {
          const application = applications.find((a) => a.id === viewingProfileFor)
          if (!application) return null
          return (
            <ApplicationProfileModal
              application={application}
              counselors={counselors}
              onClose={() => setViewingProfileFor(null)}
              onUpdateStatus={() => {
                setViewingProfileFor(null)
                setEditingStatusFor(application.id)
              }}
              onReassign={() => {
                setViewingProfileFor(null)
                setEditingAssignFor(application.id)
              }}
              onPaymentUrlSaved={refresh}
            />
          )
        })()}
    </div>
  )
}
