'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLanguage } from '../../../i18n/LanguageContext'
import { localizedName } from '../../../i18n/localizedName'
import { translateErrorCode } from '../../../i18n/translateErrorCode'
import type { Dictionary } from '../../../i18n/translations'
import { ApplicationProfileModal } from '../../../components/ApplicationProfileModal'
import { VisitDetailModal } from '../../../components/VisitDetailModal'
import { ClientHistoryBadge } from '../../../components/ClientHistoryBadge'
import {
  STATUS_PILL_CLASS,
  type ApplicationRow,
  type CounselorOption,
} from '../../../components/ApplicationsPanel'
import type { ApplicationStatus } from '../../../domain/entities/application'
import type { VisitStatus, VisitStudentStatus, VisitType } from '../../../domain/entities/visit'
import { FollowUpDueBadge } from '../../../components/FollowUpDueBadge'

interface VisitRow {
  id: string
  type: VisitType
  name: string
  phone: string
  desiredCountry: string | null
  status: VisitStatus
  studentStatus: VisitStudentStatus | null
  createdAt: string
  pickedUpAt: string | null
  closedAt: string | null
  note: string | null
  followUpDueAt: string | null
}

const STATUS_OPTIONS: ApplicationStatus[] = [
  'pending',
  'under_review',
  'documents_requested',
  'submitted_to_source',
  'approved',
  'rejected',
]

const TYPE_LABEL_KEY: Record<VisitType, keyof Dictionary['students']> = {
  new: 'typeNew',
  follow_up: 'typeFollowUp',
  visa: 'typeVisa',
}
const STUDENT_STATUS_LABEL_KEY: Record<VisitStudentStatus, keyof Dictionary['students']> = {
  waiting: 'statusWaiting',
  in_session: 'statusInSession',
  follow_up_needed: 'statusFollowUpNeeded',
  closed: 'statusClosed',
}
const STUDENT_STATUS_PILL_CLASS: Record<VisitStudentStatus, string> = {
  waiting: 'watch',
  in_session: 'on-track',
  follow_up_needed: 'inactive',
  closed: 'on-track',
}
const STATUS_FILTERS: (VisitStudentStatus | 'all')[] = [
  'all',
  'waiting',
  'in_session',
  'follow_up_needed',
  'closed',
]

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url)
  if (!response.ok) return null
  return response.json()
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function StudentsPanel() {
  const { t, language } = useLanguage()
  const { data: session } = useSession()
  const scopes = (session?.user?.scopes as string[] | undefined) ?? []
  const showApplicationsSection =
    scopes.includes('visa_services') || scopes.includes('exam_services')
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [counselors, setCounselors] = useState<CounselorOption[]>([])
  const [viewingProfileFor, setViewingProfileFor] = useState<string | null>(null)
  const [viewingVisitFor, setViewingVisitFor] = useState<string | null>(null)
  const [editingStatusFor, setEditingStatusFor] = useState<string | null>(null)
  const [editingAssignFor, setEditingAssignFor] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<Record<string, ApplicationStatus>>({})
  const [pendingNote, setPendingNote] = useState<Record<string, string>>({})
  const [pendingRef, setPendingRef] = useState<Record<string, string>>({})
  const [pendingCounselor, setPendingCounselor] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<VisitStudentStatus | 'all'>('all')

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [visitsData, applicationsData, counselorsData] = await Promise.all([
      fetchJson<VisitRow[]>('/api/counselor/students/visits'),
      fetchJson<ApplicationRow[]>('/api/counselor/students/applications'),
      fetchJson<CounselorOption[]>('/api/counselors/active'),
    ])
    setVisits(Array.isArray(visitsData) ? visitsData : [])
    setApplications(Array.isArray(applicationsData) ? applicationsData : [])
    setCounselors(Array.isArray(counselorsData) ? counselorsData : [])
  }

  // نستنى رد السيرفر قبل ما نغيّر الشاشة — كان التحديث الفوري يعرض حالة انرفضت
  // فعليًا. نرجع رمز الخطأ للنافذة عشان تعرضه، أو null لو انحفظ
  async function handleSetVisitStatus(
    visitId: string,
    studentStatus: VisitStudentStatus,
    followUpDueAt: string | null
  ): Promise<string | null> {
    try {
      const response = await fetch(`/api/counselor/students/visits/${visitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentStatus, followUpDueAt }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.ok) return result.reason ?? 'couldNotSaveStatus'
      await refresh()
      return null
    } catch {
      return 'couldNotSaveStatus'
    }
  }

  async function handleSaveStatus(applicationId: string) {
    setError(null)
    const status = pendingStatus[applicationId]
    if (!status) return
    // الشبكة لو انقطعت، أو رجع السيرفر جسماً مو JSON، كان الاستثناء يعدّي
    // فوق setError ويطلع بلا أي رسالة — الحفظ ما صار والمستشار ما يدري
    let result: { ok?: boolean; reason?: string; from?: string; to?: string } | null = null
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
      result = await response.json().catch(() => null)
      if (!response.ok && result === null) {
        setError(t('applications', 'couldNotUpdateStatus'))
        return
      }
    } catch {
      setError(t('applications', 'couldNotUpdateStatus'))
      return
    }
    if (!result?.ok) {
      type StatusKey = Parameters<typeof t>[1] & string
      const params =
        result?.reason === 'invalidStatusTransition' && result.from && result.to
          ? {
              from: t('applications', result.from as StatusKey),
              to: t('applications', result.to as StatusKey),
            }
          : undefined
      setError(
        translateErrorCode(language, result?.reason, params) ??
          t('applications', 'couldNotUpdateStatus')
      )
      return
    }
    setEditingStatusFor(null)
    await refresh()
  }

  async function handleSaveAssign(
    applicationId: string,
    kind: string,
    currentCounselorId: string | null
  ) {
    setError(null)
    const counselorId = pendingCounselor[applicationId] ?? currentCounselorId ?? ''
    let result: { ok?: boolean; reason?: string } | null = null
    try {
      const response = await fetch(`/api/applications/kind/${kind}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, counselorId: counselorId || null }),
      })
      result = await response.json().catch(() => null)
      if (!response.ok && result === null) {
        setError(t('applications', 'couldNotAssignCounselor'))
        return
      }
    } catch {
      setError(t('applications', 'couldNotAssignCounselor'))
      return
    }
    if (!result?.ok) {
      setError(
        translateErrorCode(language, result?.reason) ?? t('applications', 'couldNotAssignCounselor')
      )
      return
    }
    setEditingAssignFor(null)
    await refresh()
  }

  const visitCountByPhone: Record<string, number> = {}
  for (const visit of visits) {
    visitCountByPhone[visit.phone] = (visitCountByPhone[visit.phone] ?? 0) + 1
  }

  const filterCounts: Record<VisitStudentStatus | 'all', number> = {
    all: visits.length,
    waiting: 0,
    in_session: 0,
    follow_up_needed: 0,
    closed: 0,
  }
  for (const visit of visits) {
    filterCounts[visit.studentStatus ?? 'waiting'] += 1
  }
  const filteredVisits =
    activeFilter === 'all'
      ? visits
      : visits.filter((v) => (v.studentStatus ?? 'waiting') === activeFilter)

  return (
    <div className="screen-dash">
      <div className="accounts-panel">
        <div className="date-range-row">
          <h3>{t('students', 'title')}</h3>
          <div className="date-range-export">
            <a href={`/api/counselor/students/export?lang=${language}`} className="export-btn">
              {t('students', 'export')}
            </a>
          </div>
        </div>
        {error && <p className="err">{error}</p>}

        <div className="students-section-label">
          <h4>{t('students', 'visitsTitle')}</h4>
          <span className="students-section-count">{visits.length}</span>
        </div>
        {visits.length > 0 && (
          <div className="status-filter-chips">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`status-filter-chip ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter === 'all'
                  ? t('students', 'filterAll')
                  : t('students', STUDENT_STATUS_LABEL_KEY[filter])}{' '}
                ({filterCounts[filter]})
              </button>
            ))}
          </div>
        )}
        {visits.length === 0 ? (
          <p className="students-empty">{t('students', 'noVisits')}</p>
        ) : filteredVisits.length === 0 ? (
          <p className="students-empty">{t('students', 'noVisitsFiltered')}</p>
        ) : (
          <div className="students-card-grid">
            {filteredVisits.map((visit) => (
              <div
                className="student-card student-card-clickable"
                key={visit.id}
                role="button"
                tabIndex={0}
                onClick={() => setViewingVisitFor(visit.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setViewingVisitFor(visit.id)
                  }
                }}
              >
                <div className="student-card-top">
                  <div
                    className={`student-avatar ${STUDENT_STATUS_PILL_CLASS[visit.studentStatus ?? 'waiting']}`}
                  >
                    {initials(visit.name)}
                  </div>
                  <div>
                    <div className="student-card-name">{visit.name}</div>
                    <div className="student-card-sub">
                      {t('students', TYPE_LABEL_KEY[visit.type])}
                    </div>
                  </div>
                </div>
                <div className="student-card-foot">
                  <span
                    className={`pill ${STUDENT_STATUS_PILL_CLASS[visit.studentStatus ?? 'waiting']}`}
                  >
                    {t('students', STUDENT_STATUS_LABEL_KEY[visit.studentStatus ?? 'waiting'])}
                  </span>
                  <ClientHistoryBadge
                    phone={visit.phone}
                    count={visitCountByPhone[visit.phone] ?? 1}
                    variant="inline"
                  />
                </div>
                {visit.studentStatus === 'follow_up_needed' && visit.followUpDueAt && (
                  <div className="student-followup-due">
                    <FollowUpDueBadge
                      followUpDueAt={visit.followUpDueAt}
                      language={language}
                      t={t}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {(showApplicationsSection || applications.length > 0) && (
          <>
            <div className="students-section-label">
              <h4>{t('students', 'applicationsTitle')}</h4>
              <span className="students-section-count">{applications.length}</span>
            </div>
            {applications.length === 0 ? (
              <p className="students-empty">{t('students', 'noApplications')}</p>
            ) : (
              <div className="students-card-grid">
                {applications.map((application) => (
                  <button
                    type="button"
                    className="student-card student-card-clickable"
                    key={application.id}
                    onClick={() => setViewingProfileFor(application.id)}
                  >
                    <div className="student-card-top">
                      <div className="student-avatar">{initials(application.name)}</div>
                      <div>
                        <div className="student-card-name">{application.name}</div>
                        <div className="student-card-sub">{application.applicationNumber}</div>
                      </div>
                    </div>
                    <span className={`pill ${STATUS_PILL_CLASS[application.status]}`}>
                      {t('applications', application.status)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {editingStatusFor &&
          (() => {
            const application = applications.find((a) => a.id === editingStatusFor)
            if (!application) return null
            return (
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
                  <button type="button" onClick={() => setEditingStatusFor(null)}>
                    {t('applications', 'cancel')}
                  </button>
                </div>
              </div>
            )
          })()}

        {editingAssignFor &&
          (() => {
            const application = applications.find((a) => a.id === editingAssignFor)
            if (!application) return null
            return (
              <div className="applications-status-editor">
                <label>
                  <span>{t('applications', 'counselor')}</span>
                  <select
                    value={pendingCounselor[application.id] ?? application.counselorId ?? ''}
                    onChange={(e) =>
                      setPendingCounselor({ ...pendingCounselor, [application.id]: e.target.value })
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
                      handleSaveAssign(application.id, application.kind, application.counselorId)
                    }
                  >
                    {t('applications', 'saveAssign')}
                  </button>
                  <button type="button" onClick={() => setEditingAssignFor(null)}>
                    {t('applications', 'cancel')}
                  </button>
                </div>
              </div>
            )
          })()}

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

        {viewingVisitFor &&
          (() => {
            const visit = visits.find((v) => v.id === viewingVisitFor)
            if (!visit) return null
            return (
              <VisitDetailModal
                visit={visit}
                onClose={() => setViewingVisitFor(null)}
                onStatusChange={(status, dueAt) => handleSetVisitStatus(visit.id, status, dueAt)}
              />
            )
          })()}
      </div>
    </div>
  )
}
