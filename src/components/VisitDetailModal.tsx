'use client'
import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { Dictionary, Language } from '../i18n/translations'
import { COUNTRY_LABEL_KEYS, isKnownCountryScope } from '../i18n/countryLabels'
import { translateErrorCode } from '../i18n/translateErrorCode'
import type { VisitStatus, VisitStudentStatus, VisitType } from '../domain/entities/visit'
import { editableStudentStatusesFor } from '../domain/validation/validateStudentStatusForVisit'
import { defaultFollowUpDueDate } from '../domain/time/defaultFollowUpDueDate'
import { KUWAIT_TIME_ZONE } from '../domain/time/kuwaitTime'
import { useDialog } from '../hooks/useDialog'

export interface VisitDetailRow {
  id: string
  type: VisitType
  name: string
  phone: string
  desiredCountry: string | null
  status: VisitStatus
  studentStatus: VisitStudentStatus | null
  counselorId?: string | null
  counselorName?: string | null
  counselorNameAr?: string | null
  counselorSignedInToday?: boolean | null
  counselorQuietWorkingDays?: number | null
  createdAt: string
  pickedUpAt: string | null
  closedAt: string | null
  note: string | null
  followUpDueAt?: string | null
}

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
const VISIT_STATUS_LABEL_KEY: Record<VisitStatus, keyof Dictionary['visits']> = {
  next: 'statusOpen',
  closed: 'statusClosed',
}

function formatTimelineWhen(isoDate: string, language: Language): string {
  return new Date(isoDate).toLocaleString(language, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: KUWAIT_TIME_ZONE,
  })
}

interface VisitDetailModalProps {
  visit: VisitDetailRow
  onClose: () => void
  // ترجع null لو انحفظ، أو رمز خطأ (من السيرفر) نعرضه بالنافذة بدل ما نسكّرها
  onStatusChange?: (
    studentStatus: VisitStudentStatus,
    followUpDueAt: string | null
  ) => Promise<string | null>
}

export function VisitDetailModal({ visit, onClose, onStatusChange }: VisitDetailModalProps) {
  const { t, language } = useLanguage()
  // بس الزيارة المقفولة تتغير حالتها يدويًا، وبس بين "مقفول" و"يحتاج متابعة" —
  // المفتوحة تتحرك بالبدء والإنهاء بالطابور
  const editableStatuses = editableStudentStatusesFor(visit.status)
  const canEditStatus = Boolean(onStatusChange) && editableStatuses.length > 0
  const { dialogProps, titleId } = useDialog({ open: true, onClose })
  const [pendingStatus, setPendingStatus] = useState<VisitStudentStatus>(
    visit.studentStatus && editableStatuses.includes(visit.studentStatus)
      ? visit.studentStatus
      : 'closed'
  )
  const [dueDate, setDueDate] = useState(
    visit.followUpDueAt ? visit.followUpDueAt.slice(0, 10) : defaultFollowUpDueDate()
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const needsDueDate = pendingStatus === 'follow_up_needed'

  // كانت هالشاشة تعرض قيمة الدولة كما هي بقاعدة البيانات، فتبقى إنجليزي حتى
  // بالوضع العربي — نفس الحل المستخدم بشاشات لوحة التحكم والزيارات
  function countryLabel(value: string): string {
    return isKnownCountryScope(value) ? t('countries', COUNTRY_LABEL_KEYS[value]) : value
  }

  async function handleSaveStatus() {
    if (!onStatusChange || (needsDueDate && !dueDate)) return
    setSaving(true)
    setSaveError(null)
    const errorCode = await onStatusChange(pendingStatus, needsDueDate ? dueDate : null)
    setSaving(false)
    if (errorCode) {
      setSaveError(translateErrorCode(language, errorCode) ?? t('students', 'couldNotSaveStatus'))
      return
    }
    onClose()
  }

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()} {...dialogProps}>
        <div className="profile-modal-head">
          <div>
            <div className="profile-modal-who" id={titleId}>
              {visit.name}
            </div>
            <div className="profile-modal-meta">
              {t('students', TYPE_LABEL_KEY[visit.type])} · {visit.phone}
            </div>
          </div>
          <button
            type="button"
            className="profile-modal-close"
            onClick={onClose}
            aria-label={t('students', 'close')}
          >
            ✕
          </button>
        </div>

        <div className="profile-modal-body">
          <div className="profile-section">
            <div className="profile-section-label">{t('students', 'contact')}</div>
            <div className="profile-answers-list">
              <div className="profile-answer-row">
                <span className="k">{t('visits', 'phone')}</span>
                <span className="v">{visit.phone}</span>
              </div>
              <div className="profile-answer-row">
                <span className="k">{t('students', 'desiredCountry')}</span>
                <span className="v">
                  {visit.desiredCountry ? countryLabel(visit.desiredCountry) : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-section-label">{t('students', 'status')}</div>
            <div className="profile-answers-list">
              <div className="profile-answer-row">
                <span className="k">{t('visits', 'status')}</span>
                <span className="v">{t('visits', VISIT_STATUS_LABEL_KEY[visit.status])}</span>
              </div>
              {!canEditStatus && (
                <div className="profile-answer-row">
                  <span className="k">{t('students', 'status')}</span>
                  <span className="v">
                    {visit.studentStatus
                      ? t('students', STUDENT_STATUS_LABEL_KEY[visit.studentStatus])
                      : '—'}
                  </span>
                </div>
              )}
            </div>
            {canEditStatus && (
              <div className="applications-status-editor">
                <label>
                  <span>{t('students', 'status')}</span>
                  <select
                    value={pendingStatus}
                    onChange={(e) => setPendingStatus(e.target.value as VisitStudentStatus)}
                  >
                    {editableStatuses.map((status) => (
                      <option key={status} value={status}>
                        {t('students', STUDENT_STATUS_LABEL_KEY[status])}
                      </option>
                    ))}
                  </select>
                </label>
                {needsDueDate && (
                  <div className="follow-up-due-box">
                    <label htmlFor="visit-follow-up-due-at" className="follow-up-due-label">
                      {t('counselor', 'followUpDueLabel')}
                    </label>
                    <input
                      id="visit-follow-up-due-at"
                      type="date"
                      className="follow-up-due-input"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                    <div className="follow-up-due-hint">{t('counselor', 'followUpDueHint')}</div>
                  </div>
                )}
                {saveError && <p className="err">{saveError}</p>}
                <div className="applications-status-editor-actions">
                  <button
                    type="button"
                    className="btn-orange"
                    onClick={handleSaveStatus}
                    disabled={saving || (needsDueDate && !dueDate)}
                  >
                    {t('applications', 'saveStatus')}
                  </button>
                </div>
              </div>
            )}
            {onStatusChange && !canEditStatus && (
              <p className="profile-empty">{t('students', 'openVisitStatusHint')}</p>
            )}
          </div>

          {visit.note && (
            <div className="profile-section">
              <div className="profile-section-label">{t('visits', 'counselorNote')}</div>
              <div className="counselor-note">
                <p>{visit.note}</p>
              </div>
            </div>
          )}

          <div className="profile-section">
            <div className="profile-section-label">{t('visits', 'timeline')}</div>
            <div className="mini-timeline">
              <div className="mini-timeline-step done">
                <span className="mini-timeline-dot" />
                <span className="mini-timeline-label">{t('visits', 'timelineSubmitted')}</span>
                <span className="mini-timeline-when">
                  {formatTimelineWhen(visit.createdAt, language)}
                </span>
              </div>
              <div className={`mini-timeline-step ${visit.pickedUpAt ? 'done' : 'pending'}`}>
                <span className="mini-timeline-dot" />
                <span className="mini-timeline-label">{t('visits', 'timelinePickedUp')}</span>
                <span className="mini-timeline-when">
                  {visit.pickedUpAt
                    ? formatTimelineWhen(visit.pickedUpAt, language)
                    : t('visits', 'timelineNotYet')}
                </span>
              </div>
              <div className={`mini-timeline-step ${visit.closedAt ? 'done' : 'pending'}`}>
                <span className="mini-timeline-dot" />
                <span className="mini-timeline-label">{t('visits', 'timelineClosed')}</span>
                <span className="mini-timeline-when">
                  {visit.closedAt
                    ? formatTimelineWhen(visit.closedAt, language)
                    : t('visits', 'timelineNotYet')}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-modal-actions">
            <button type="button" onClick={onClose}>
              {t('students', 'close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
