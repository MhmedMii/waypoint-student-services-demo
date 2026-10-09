'use client'
import { useEffect, useState } from 'react'
import { COUNTRY_LABEL_KEYS } from '../../i18n/countryLabels'
import { useLanguage } from '../../i18n/LanguageContext'
import { translateErrorCode } from '../../i18n/translateErrorCode'
import type { Dictionary } from '../../i18n/translations'
import { COUNTRY_SCOPES as COUNTRIES } from '../../domain/entities/counselor'
import { LogoTile } from '../../components/LogoTile'
import { QueueLockScreen } from '../../components/QueueLockScreen'

type VisitTab = 'new' | 'follow_up' | 'visa'

const ENDPOINT_BY_TAB: Record<VisitTab, string> = {
  new: '/api/visits/new',
  follow_up: '/api/visits/follow-up',
  visa: '/api/visits/visa',
}

interface ActiveCounselor {
  id: string
  name: string
}

// شكل الرد كما يوصل من الشبكة — ما نثق فيه قبل ما نفحصه
interface SubmitReply {
  ok?: unknown
  errors?: unknown
  visitId?: unknown
  counselorName?: string | null
}

export function IntakeForm({ onSubmitted }: { onSubmitted?: (visitId: string) => void }) {
  const { t, language } = useLanguage()
  const [tab, setTab] = useState<VisitTab>('new')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [desiredCountry, setDesiredCountry] = useState<string>(COUNTRIES[0])
  const [counselorId, setCounselorId] = useState('')
  const [activeCounselors, setActiveCounselors] = useState<ActiveCounselor[]>([])
  const [counselorsLoad, setCounselorsLoad] = useState<'pending' | 'ok' | 'failed'>('pending')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showDuplicateOverride, setShowDuplicateOverride] = useState(false)
  const [activeVisit, setActiveVisit] = useState<{
    id: string
    counselorName: string | null
  } | null>(null)

  // نجيب قائمة الكاونسلرز النشطين بس أول ما تاب Follow up يصير فعّال، مو مع كل تحميل للفورم
  useEffect(() => {
    if (tab !== 'follow_up') return
    fetch('/api/counselors/active')
      .then((r) => r.json())
      .then((data) => {
        // قائمة = جواب. أي شي ثاني (رفض، صفحة خطأ) فشل، مو "ما فيه أحد"
        if (!Array.isArray(data)) throw new Error('not a list')
        setActiveCounselors(data)
        setCounselorsLoad('ok')
      })
      // القائمة القديمة تبقى لو كانت محمّلة؛ الرسالة تطلع بس لما ما عندنا أسماء
      .catch(() => setCounselorsLoad('failed'))
  }, [tab])

  async function submitVisit(overrideDuplicate: boolean) {
    setErrors([])
    setShowDuplicateOverride(false)
    setSubmitting(true)
    const body =
      tab === 'new'
        ? { name, phone, desiredCountry, overrideDuplicate }
        : tab === 'follow_up'
          ? { name, phone, counselorId, overrideDuplicate }
          : { name, phone, overrideDuplicate }

    let result: SubmitReply | null = null
    try {
      const response = await fetch(ENDPOINT_BY_TAB[tab], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      result = await response.json()
    } catch {
      // ما وصل، أو رجع شي مو JSON (صفحة خطأ من المنصة). للزائر نفس الشي: ما انرسل
    } finally {
      setSubmitting(false)
    }
    if (result?.ok !== true) {
      // أخطاء التحقق والـ 429 تجي بقائمة. أي جسم ثاني ما نعرضه كأنه جواب
      const reasons = Array.isArray(result?.errors) ? (result.errors as string[]) : []
      setErrors(reasons.length > 0 ? reasons : [t('intake', 'submitFailed')])
      setShowDuplicateOverride(reasons.includes('duplicateVisitPending'))
      return
    }
    const visitId = result.visitId as string
    const counselorName =
      tab === 'follow_up'
        ? (activeCounselors.find((c) => c.id === counselorId)?.name ?? null)
        : (result.counselorName ?? null)
    setActiveVisit({ id: visitId, counselorName })
    onSubmitted?.(visitId)
    setName('')
    setPhone('')
    setCounselorId('')
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    submitVisit(false)
  }

  function handleUnlocked() {
    setActiveVisit(null)
  }

  if (activeVisit) {
    return (
      <>
        <LogoTile />
        <QueueLockScreen
          visitId={activeVisit.id}
          initialCounselorName={activeVisit.counselorName}
          onUnlocked={handleUnlocked}
        />
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
            onClick={() => setTab('new')}
            className={tab === 'new' ? 'active' : ''}
          >
            {t('intake', 'newClient')}
          </button>
          <button
            type="button"
            onClick={() => setTab('follow_up')}
            className={tab === 'follow_up' ? 'active' : ''}
          >
            {t('intake', 'followUp')}
          </button>
          <button
            type="button"
            onClick={() => setTab('visa')}
            className={tab === 'visa' ? 'active' : ''}
          >
            {t('intake', 'visaOther')}
          </button>
        </div>

        <label htmlFor="name">{t('intake', 'fullName')}</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />

        <label htmlFor="phone">{t('intake', 'phone')}</label>
        <input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
          inputMode="numeric"
          maxLength={8}
          required
        />

        {tab === 'new' && (
          <>
            <label htmlFor="desiredCountry">{t('intake', 'desiredCountry')}</label>
            <select
              id="desiredCountry"
              value={desiredCountry}
              onChange={(e) => setDesiredCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {t('countries', COUNTRY_LABEL_KEYS[c])}
                </option>
              ))}
            </select>
          </>
        )}

        {tab === 'follow_up' && (
          <>
            <label htmlFor="counselorId">{t('intake', 'counselor')}</label>
            <select
              id="counselorId"
              value={counselorId}
              onChange={(e) => setCounselorId(e.target.value)}
              required
            >
              <option value="" disabled>
                {t('intake', 'selectCounselor')}
              </option>
              {activeCounselors.map((counselor) => (
                <option key={counselor.id} value={counselor.id}>
                  {counselor.name}
                </option>
              ))}
            </select>
            {/* قائمة فاضية = الفورم ما ينرسل. نفس الوجهة للزائر (المكتب)، بس السبب
                لازم يكون صادق: ما قدرنا نحمّل ≠ ما فيه أحد */}
            {activeCounselors.length === 0 && counselorsLoad !== 'pending' && (
              <ul className="err" role="alert">
                <li>
                  {t(
                    'intake',
                    counselorsLoad === 'failed' ? 'counselorsLoadFailed' : 'noCounselorsAvailable'
                  )}
                </li>
              </ul>
            )}
          </>
        )}

        {errors.length > 0 && (
          <ul className="err">
            {errors.map((e) => (
              <li key={e}>{translateErrorCode(language, e) ?? e}</li>
            ))}
          </ul>
        )}
        {showDuplicateOverride && (
          <button
            type="button"
            className="duplicate-override-link"
            onClick={() => submitVisit(true)}
            disabled={submitting}
          >
            {t('intake', 'duplicateVisitOverride')}
          </button>
        )}

        <button type="submit" className="btn-orange" disabled={submitting}>
          {t('intake', 'saveVisit')}
        </button>
      </form>
    </>
  )
}
