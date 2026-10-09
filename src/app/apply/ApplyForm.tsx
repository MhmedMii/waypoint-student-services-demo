'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { translateErrorCode } from '../../i18n/translateErrorCode'
import { LogoTile } from '../../components/LogoTile'
import { DynamicServiceFields } from '../../components/DynamicServiceFields'
import { ServicePicker, splitServiceLabel } from '../../components/ServicePicker'
import {
  VISA_SERVICES,
  EXAM_SERVICES,
  type ApplicationKind,
  type ServiceCode,
  type VisaServiceCode,
} from '../../domain/entities/application'
import { VISA_FIXED_PAYMENT_URL } from '../../domain/payment/visaFixedPaymentLink'
import { SERVICE_FORM_SCHEMAS } from '../../domain/entities/serviceFormSchemas'
import { visibleDocumentSlots } from '../../domain/entities/requiredDocuments'
import type {
  DocumentSlotDef,
  FieldDef,
  RepeatGroupDef,
  ConditionalSectionDef,
} from '../../domain/entities/applicationFieldSchema'

const SERVICES_BY_KIND: Record<ApplicationKind, readonly ServiceCode[]> = {
  visa: VISA_SERVICES,
  exam: EXAM_SERVICES,
}

const VISA_FLAG: Record<VisaServiceCode, string> = {
  'uk-student': '🇬🇧',
  'us-f1': '🇺🇸',
  'malta-student': '🇲🇹',
  'ireland-student': '🇮🇪',
  'australia-student': '🇦🇺',
  'new-zealand-student': '🇳🇿',
}

// شكل الرد كما يوصل من الشبكة — ما نثق فيه قبل ما نفحصه
interface SubmitReply {
  ok?: unknown
  errors?: unknown
  applicationId?: unknown
  applicationNumber?: unknown
}

function collectRepeatGroups(
  entries: Array<FieldDef | RepeatGroupDef | ConditionalSectionDef>
): RepeatGroupDef[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'repeatGroup') return [entry]
    if (entry.kind === 'conditionalSection') return collectRepeatGroups(entry.fields)
    return []
  })
}

export function ApplyForm() {
  const { t, language } = useLanguage()
  const searchParams = useSearchParams()
  const initialKind: ApplicationKind = searchParams.get('kind') === 'exam' ? 'exam' : 'visa'
  const [kind, setKind] = useState<ApplicationKind>(initialKind)
  const [serviceCode, setServiceCode] = useState<ServiceCode>(SERVICES_BY_KIND[initialKind][0])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [repeatValues, setRepeatValues] = useState<Record<string, string[][]>>({})
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [submittedNumber, setSubmittedNumber] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  // الزر لازم يقفل وقت إرسال الطلب نفسه، مو بس وقت الرفع — ضغطتين = طلبين برقمين
  const [submitting, setSubmitting] = useState(false)
  // قبل كنا نبلع أي فشل برفع الملفات بصمت: العميل يشوف "تم الإرسال" والموظف يشوف
  // "ما فيه مستندات"، وما حد يدري إن فيه ملف ضاع. صرنا نتابع كل ملف بنفسه
  const [failedSlots, setFailedSlots] = useState<DocumentSlotDef[]>([])
  const [uploadedSlots, setUploadedSlots] = useState<DocumentSlotDef[]>([])
  const [linkCopied, setLinkCopied] = useState(false)
  const services = SERVICES_BY_KIND[kind]

  const schema = SERVICE_FORM_SCHEMAS[serviceCode]

  function handleKindChange(nextKind: ApplicationKind) {
    setKind(nextKind)
    setServiceCode(SERVICES_BY_KIND[nextKind][0])
    setFieldValues({})
    setRepeatValues({})
    setDocumentFiles({})
  }

  function handleServiceChange(nextServiceCode: ServiceCode) {
    setServiceCode(nextServiceCode)
    setFieldValues({})
    setRepeatValues({})
    setDocumentFiles({})
  }

  function handleRepeatChange(
    groupId: string,
    rowIndex: number,
    colId: string,
    value: string,
    columns: RepeatGroupDef['columns']
  ) {
    setRepeatValues((current) => {
      const def = collectRepeatGroups(schema.fields).find((g) => g.id === groupId)
      const rowCount = def?.count ?? 1
      const rows = current[groupId] ?? Array.from({ length: rowCount }, () => columns.map(() => ''))
      const nextRows = rows.map((row, i) => {
        if (i !== rowIndex) return row
        const colIndex = columns.findIndex((c) => c.id === colId)
        const nextRow = [...row]
        nextRow[colIndex] = value
        return nextRow
      })
      return { ...current, [groupId]: nextRows }
    })
  }

  function buildFieldsPayload(): Record<string, string> {
    const fields: Record<string, string> = {}
    for (const [id, value] of Object.entries(fieldValues)) {
      if (value) fields[id] = value
    }
    for (const group of collectRepeatGroups(schema.fields)) {
      const rows = repeatValues[group.id]
      if (!rows) continue
      const hasAnyValue = rows.some((row) => row.some((cell) => cell))
      if (!hasAnyValue) continue
      fields[group.id] = JSON.stringify(
        rows.map((row) => Object.fromEntries(group.columns.map((col, i) => [col.id, row[i] ?? ''])))
      )
    }
    return fields
  }

  // نرفع ملف ملف ونكمّل حتى لو طاح وحد — قبل، أول فشل كان يوقف الباقي كلهم.
  // نرجّع الخانات اللي فشلت عشان نعرضها للعميل ويقدر يعيد المحاولة
  async function uploadDocuments(
    applicationId: string,
    slots: DocumentSlotDef[]
  ): Promise<DocumentSlotDef[]> {
    setUploading(true)
    const failed: DocumentSlotDef[] = []
    const uploaded: DocumentSlotDef[] = []
    for (const slot of slots) {
      const file = documentFiles[slot.id]
      if (!file) continue
      try {
        await upload(file.name, file, {
          access: 'private',
          handleUploadUrl: '/api/applications/upload',
          clientPayload: JSON.stringify({
            applicationId,
            originalFileName: file.name,
            sizeBytes: file.size,
            documentLabel: slot.label,
          }),
        })
        uploaded.push(slot)
      } catch {
        failed.push(slot)
      }
    }
    setUploadedSlots((current) => [...current, ...uploaded])
    setFailedSlots(failed)
    setUploading(false)
    return failed
  }

  async function retryFailedUploads() {
    if (!submittedId || failedSlots.length === 0) return
    await uploadDocuments(submittedId, failedSlots)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrors([])
    setSubmitting(true)

    let result: SubmitReply | null = null
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, serviceCode, name, phone, fields: buildFieldsPayload() }),
      })
      result = await response.json()
    } catch {
      // نفس قاعدة الكشك: ما وصل أو رد بشي مو JSON = ما انرسل، والخانات باقية
    } finally {
      setSubmitting(false)
    }
    if (result?.ok !== true) {
      const reasons = Array.isArray(result?.errors) ? (result.errors as string[]) : []
      setErrors(reasons.length > 0 ? reasons : [t('apply', 'couldNotSubmit')])
      return
    }
    const applicationId = result.applicationId as string
    const applicationNumber = result.applicationNumber as string

    const chosenDocuments = visibleDocumentSlots(schema, fieldValues).filter(
      (slot) => documentFiles[slot.id]
    )
    const failed =
      chosenDocuments.length > 0 ? await uploadDocuments(applicationId, chosenDocuments) : []

    setSubmittedId(applicationId)
    setSubmittedNumber(applicationNumber)
    setName('')
    setPhone('')
    setFieldValues({})
    setRepeatValues({})
    // نحتفظ بملفات الخانات اللي فشلت بس — بدونها زر "حاول مرة ثانية" ما عنده شي يرسله
    setDocumentFiles((current) =>
      Object.fromEntries(failed.map((slot) => [slot.id, current[slot.id] ?? null]))
    )
  }

  if (submittedId) {
    const statusUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/apply/status/${submittedId}` : ''
    return (
      <>
        <LogoTile />
        <div className="apply-confirm">
          <p>{t('apply', 'submitted')}</p>
          <p className="apply-confirm-number">
            {t('apply', 'yourApplicationNumber')} <strong>{submittedNumber}</strong>
          </p>
          {failedSlots.length > 0 && (
            <div className="apply-upload-failed" role="alert">
              <div className="apply-upload-failed-title">
                {t('apply', 'uploadsFailedTitle')
                  .replace('{failed}', String(failedSlots.length))
                  .replace('{total}', String(failedSlots.length + uploadedSlots.length))}
              </div>
              <ul className="apply-upload-list">
                {uploadedSlots.map((slot) => (
                  <li key={slot.id}>
                    <span>{language === 'ar' ? slot.labelAr : slot.label}</span>
                    <span className="apply-upload-ok">{t('apply', 'uploadOk')}</span>
                  </li>
                ))}
                {failedSlots.map((slot) => (
                  <li key={slot.id}>
                    <span>{language === 'ar' ? slot.labelAr : slot.label}</span>
                    <span className="apply-upload-bad">{t('apply', 'uploadFailed')}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-orange"
                onClick={retryFailedUploads}
                disabled={uploading}
              >
                {t('apply', uploading ? 'uploading' : 'retryUploads')}
              </button>
              <div className="apply-upload-failed-hint">{t('apply', 'uploadsFailedHint')}</div>
            </div>
          )}
          {kind === 'visa' ? (
            <>
              <div className="apply-pay-hero">
                <div className="apply-pay-hero-label">{t('apply', 'paymentRequired')}</div>
                <div className="apply-pay-hero-sub">{t('apply', 'completePaymentToProceed')}</div>
                <a href={VISA_FIXED_PAYMENT_URL} target="_blank" rel="noreferrer">
                  {t('apply', 'payNow')}
                </a>
              </div>
              <div className="apply-status-link-mini">
                {t('apply', 'saveStatusLinkHint')}
                <div className="apply-payment-link-row">
                  <span className="apply-payment-link-url">{statusUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(statusUrl)
                      setLinkCopied(true)
                    }}
                  >
                    {linkCopied ? t('apply', 'copiedLink') : t('apply', 'copyLink')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="apply-payment-link-card">
              <p>{t('apply', 'yourPaymentLink')}</p>
              <div className="apply-payment-link-row">
                <span className="apply-payment-link-url">{statusUrl}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(statusUrl)
                    setLinkCopied(true)
                  }}
                >
                  {linkCopied ? t('apply', 'copiedLink') : t('apply', 'copyLink')}
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <LogoTile />
      <form onSubmit={handleSubmit} className="intake-form">
        <div className="type-tabs">
          <button
            type="button"
            onClick={() => handleKindChange('visa')}
            className={kind === 'visa' ? 'active' : ''}
          >
            {t('apply', 'visaTab')}
          </button>
          <button
            type="button"
            onClick={() => handleKindChange('exam')}
            className={kind === 'exam' ? 'active' : ''}
          >
            {t('apply', 'examTab')}
          </button>
        </div>

        {kind === 'visa' ? (
          <div className="apply-country-field">
            <label id="apply-country-label">
              {t('apply', 'country')}
              <span className="apply-req">*</span>
            </label>
            <ServicePicker
              options={services.map((service) => {
                const { name, detail } = splitServiceLabel(t('apply', service))
                return { value: service, icon: VISA_FLAG[service as VisaServiceCode], name, detail }
              })}
              value={serviceCode}
              onChange={(next) => handleServiceChange(next as ServiceCode)}
              ariaLabel={t('apply', 'country')}
              searchPlaceholder={t('apply', 'searchCountries').replace(
                '{count}',
                String(services.length)
              )}
              noMatchText={t('apply', 'noCountryMatch')}
              moreBelowText={t('apply', 'moreCountriesBelow')}
            />
          </div>
        ) : (
          <div className="apply-service-chips" role="radiogroup" aria-label={t('apply', 'service')}>
            {services.map((service) => (
              <button
                type="button"
                key={service}
                className={`apply-service-chip${service === serviceCode ? ' active' : ''}`}
                aria-pressed={service === serviceCode}
                onClick={() => handleServiceChange(service)}
              >
                {t('apply', service)}
              </button>
            ))}
          </div>
        )}

        <div className="apply-section-label">{t('apply', 'yourInformationSection')}</div>

        <label htmlFor="apply-name">
          {t('apply', 'fullName')}
          <span className="apply-req">*</span>
        </label>
        <input id="apply-name" value={name} onChange={(e) => setName(e.target.value)} required />

        <label htmlFor="apply-phone">
          {t('apply', 'phone')}
          <span className="apply-req">*</span>
        </label>
        <input
          id="apply-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
          inputMode="numeric"
          maxLength={8}
          required
        />

        <DynamicServiceFields
          schema={schema}
          values={fieldValues}
          onChange={(fieldId, value) =>
            setFieldValues((current) => ({ ...current, [fieldId]: value }))
          }
          repeatValues={repeatValues}
          onRepeatChange={handleRepeatChange}
          documentFiles={documentFiles}
          onDocumentChange={(slotId, file) =>
            setDocumentFiles((current) => ({ ...current, [slotId]: file }))
          }
        />

        {errors.length > 0 && (
          <ul className="err">
            {errors.map((e) => (
              <li key={e}>{translateErrorCode(language, e) ?? e}</li>
            ))}
          </ul>
        )}

        <button type="submit" className="btn-orange" disabled={submitting || uploading}>
          {t('apply', uploading ? 'uploading' : submitting ? 'sending' : 'submit')}
        </button>
      </form>
    </>
  )
}
