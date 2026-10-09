'use client'
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { SERVICE_FORM_SCHEMAS } from '../domain/entities/serviceFormSchemas'
import { missingRequiredDocuments } from '../domain/entities/requiredDocuments'
import { localizedName } from '../i18n/localizedName'
import { translateErrorCode } from '../i18n/translateErrorCode'
import { describeApplicationFields } from '../domain/entities/serviceFormSchemas/describeApplicationFields'
import { documentLabelAr } from '../domain/entities/serviceFormSchemas/documentLabelAr'
import type { ApplicationStatus, ServiceCode } from '../domain/entities/application'
import type { ApplicationRow, CounselorOption } from './ApplicationsPanel'
import { useDialog } from '../hooks/useDialog'

const STATUS_STEPS: ApplicationStatus[] = [
  'pending',
  'under_review',
  'documents_requested',
  'submitted_to_source',
  'approved',
]

interface ApplicationDocumentRow {
  id: string
  originalFileName: string
  documentLabel: string | null
}

async function fetchDocuments(applicationId: string): Promise<ApplicationDocumentRow[]> {
  const response = await fetch(`/api/applications/${applicationId}/documents`)
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

interface ApplicationProfileModalProps {
  application: ApplicationRow
  counselors: CounselorOption[]
  onClose: () => void
  onUpdateStatus: () => void
  onReassign: () => void
  onPaymentUrlSaved: () => void
}

export function ApplicationProfileModal({
  application,
  counselors,
  onClose,
  onUpdateStatus,
  onReassign,
  onPaymentUrlSaved,
}: ApplicationProfileModalProps) {
  const { t, language } = useLanguage()
  const { dialogProps, titleId } = useDialog({ open: true, onClose })
  const [documents, setDocuments] = useState<ApplicationDocumentRow[] | null>(null)
  const [paymentUrlInput, setPaymentUrlInput] = useState(application.paymentUrl ?? '')
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  useEffect(() => {
    setDocuments(null)
    fetchDocuments(application.id).then(setDocuments)
  }, [application.id])

  useEffect(() => {
    setPaymentUrlInput(application.paymentUrl ?? '')
  }, [application.paymentUrl])

  async function handleSavePaymentUrl() {
    setPaymentError(null)
    setSavingPayment(true)
    try {
      const response = await fetch(`/api/applications/${application.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentUrl: paymentUrlInput }),
      })
      const result = await response.json()
      if (!result.ok) {
        setPaymentError(
          translateErrorCode(language, result.reason) ?? t('applications', 'couldNotSetPaymentUrl')
        )
        return
      }
      onPaymentUrlSaved()
    } catch {
      setPaymentError(t('applications', 'couldNotSetPaymentUrl'))
    } finally {
      setSavingPayment(false)
    }
  }

  const answers = describeApplicationFields(
    application.serviceCode as ServiceCode,
    application.fields ?? {},
    language
  )
  const matchedCounselor = counselors.find((c) => c.id === application.counselorId)
  const counselorName = matchedCounselor
    ? localizedName(matchedCounselor.name, matchedCounselor.nameAr, language)
    : null
  const stepIndex = STATUS_STEPS.indexOf(application.status)

  // نفس قاعدة الفورم العام: نحسب المستندات المطلوبة الظاهرة ونشوف أيها ما وصل —
  // رفع فاشل بصمت كان يخلي الخانة فاضية بلا أي إشارة
  const schema = SERVICE_FORM_SCHEMAS[application.serviceCode as keyof typeof SERVICE_FORM_SCHEMAS]
  const missingDocumentLabels =
    schema && documents
      ? missingRequiredDocuments(
          schema,
          application.fields,
          documents.map((doc) => doc.documentLabel)
        ).map((slot) => (language === 'ar' ? slot.labelAr : slot.label))
      : []

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()} {...dialogProps}>
        <div className="profile-modal-head">
          <div>
            <div className="profile-modal-who" id={titleId}>
              {application.name}
            </div>
            <div className="profile-modal-meta">
              {application.applicationNumber} ·{' '}
              <span className="svc-caps">{t('apply', application.serviceCode as ServiceCode)}</span>{' '}
              · {application.phone}
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
            <div className="profile-section-label">{t('applications', 'status')}</div>
            {application.status === 'rejected' ? (
              <span className="pill inactive">{t('applications', 'rejected')}</span>
            ) : (
              <div className="status-track">
                {STATUS_STEPS.map((status, index) => (
                  <div
                    key={status}
                    className={`status-step ${index < stepIndex ? 'done' : index === stepIndex ? 'current' : ''}`}
                  >
                    {index > 0 && <div className="status-line" />}
                    <div className="status-dot" />
                    <div className="status-step-label">{t('applications', status)}</div>
                  </div>
                ))}
              </div>
            )}
            {application.statusNote && (
              <p className="profile-status-note">{application.statusNote}</p>
            )}
          </div>

          <div className="profile-section">
            <div className="profile-section-label">{t('applications', 'viewAnswers')}</div>
            {answers.length === 0 ? (
              <span className="profile-empty">{t('applications', 'noAnswers')}</span>
            ) : (
              <div className="profile-answers-list">
                {answers.map((answer, index) => (
                  <div className="profile-answer-row" key={`${answer.label}-${index}`}>
                    <span className="k">{answer.label}</span>
                    <span className="v">{answer.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-section">
            <div className="profile-section-label">{t('applications', 'documents')}</div>
            {missingDocumentLabels.length > 0 && (
              <p className="profile-missing-documents">
                {t('applications', 'missingDocuments').replace(
                  '{labels}',
                  missingDocumentLabels.join(', ')
                )}
              </p>
            )}
            {documents === null ? (
              <span className="profile-empty">…</span>
            ) : documents.length === 0 ? (
              <span className="profile-empty">{t('applications', 'noDocuments')}</span>
            ) : (
              <div className="profile-doc-chip-row">
                {documents.map((doc) => {
                  const arLabel = doc.documentLabel ? documentLabelAr(doc.documentLabel) : null
                  const label =
                    language === 'ar' && arLabel
                      ? arLabel
                      : (doc.documentLabel ?? doc.originalFileName)
                  return (
                    <a
                      key={doc.id}
                      className="profile-doc-chip"
                      href={`/api/applications/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {label}
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          <div className="profile-section">
            <div className="profile-section-label">{t('applications', 'counselor')}</div>
            <span className="profile-empty">
              {counselorName ?? t('applications', 'unassigned')}
            </span>
          </div>

          <div className="profile-section">
            <div className="profile-section-label">{t('applications', 'payment')}</div>
            {application.paymentUrl ? (
              <a
                className="profile-doc-chip profile-payment-current"
                href={application.paymentUrl}
                target="_blank"
                rel="noreferrer"
              >
                {application.paymentUrl}
              </a>
            ) : (
              <span className="profile-empty">{t('applications', 'noPaymentLink')}</span>
            )}
            <div className="profile-payment-editor">
              <input
                type="url"
                placeholder={t('applications', 'paymentUrlPlaceholder')}
                value={paymentUrlInput}
                onChange={(e) => setPaymentUrlInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-orange"
                onClick={handleSavePaymentUrl}
                disabled={savingPayment}
              >
                {t('applications', 'setPaymentLink')}
              </button>
            </div>
            {paymentError && <p className="err">{paymentError}</p>}
          </div>

          <div className="profile-modal-actions">
            <button type="button" className="btn-orange" onClick={onUpdateStatus}>
              {t('applications', 'updateStatus')}
            </button>
            <button type="button" onClick={onReassign}>
              {t('applications', 'assign')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
