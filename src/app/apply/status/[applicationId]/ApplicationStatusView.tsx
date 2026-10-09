'use client'
import { useState } from 'react'
import { useVisiblePolling } from '../../../../hooks/useVisiblePolling'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { LogoTile } from '../../../../components/LogoTile'
import type { ApplicationKind, ServiceCode } from '../../../../domain/entities/application'
import { VISA_FIXED_PAYMENT_URL } from '../../../../domain/payment/visaFixedPaymentLink'

interface PublicApplicationStatus {
  ok: boolean
  applicationNumber?: string
  kind?: ApplicationKind
  serviceCode?: ServiceCode
  status?: string
  paymentUrl?: string | null
}

// العميل يترك هالصفحة مفتوحة ينتظر تتغيّر حالته. كانت تجيب مرة وحدة وتجمد،
// فيقعد يطالع رقمًا ما يتحرك ثم يجي يسأل بنفسه
const POLL_INTERVAL_MS = 30 * 1000

export function ApplicationStatusView({ applicationId }: { applicationId: string }) {
  const { t } = useLanguage()
  const [data, setData] = useState<PublicApplicationStatus | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  // الفرق اللي كان ضايع: "السيرفر قال ما فيه طلب بهذا الرقم" شي، و"ما وصلنا
  // للسيرفر" شي ثاني تمامًا. الكود كان يحوّل انقطاع شبكة إلى "طلبك غير موجود"
  // — أسوأ جملة يقرأها عميل دفع رسومًا. ومع التحديث الدوري صارت أخطر: تكة
  // فاشلة وحدة كانت تمسح صفحة صحيحة
  async function load() {
    try {
      const response = await fetch(`/api/applications/${applicationId}/public-status`)
      if (!response.ok) {
        setLoadFailed(true)
        return
      }
      const body = await response.json().catch(() => null)
      if (typeof body?.ok !== 'boolean') {
        setLoadFailed(true)
        return
      }
      setData(body)
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }

  useVisiblePolling(() => {
    void load()
  }, POLL_INTERVAL_MS)

  // ما وصلنا ولا مرة: نقول إن الاتصال هو اللي فشل، مو إن الطلب مفقود
  if (!data && loadFailed) {
    return (
      <>
        <LogoTile />
        <div className="status-card">
          <p className="status-not-found">{t('apply', 'statusLoadFailed')}</p>
          <button type="button" className="btn-orange" onClick={() => void load()}>
            {t('apply', 'statusRetry')}
          </button>
        </div>
      </>
    )
  }

  // صفحة بيضاء بلا أي كلمة أثناء الجلب — الآن تقول إنها تحمّل
  if (!data) {
    return (
      <>
        <LogoTile />
        <div className="status-card">
          <p className="status-not-found">{t('apply', 'statusLoading')}</p>
        </div>
      </>
    )
  }

  if (!data.ok) {
    return (
      <>
        <LogoTile />
        <div className="status-card">
          <p className="status-not-found">{t('apply', 'statusPageNotFound')}</p>
        </div>
      </>
    )
  }

  const statusPillClass =
    data.status === 'approved' ? 'on-track' : data.status === 'rejected' ? 'inactive' : 'watch'

  return (
    <>
      <LogoTile />
      <div className="status-card">
        {/* تحديث متعثّر وعندنا بيانات: نخلي المعروض مكانه مع ملاحظة إنه قد
            يكون قديمًا — مسح صفحة صحيحة بسبب تكة فاشلة أسوأ من رقم متأخر */}
        {loadFailed && (
          <p className="status-stale" role="status">
            {t('apply', 'statusStale')}
          </p>
        )}
        <div className="status-card-head">
          <span className="status-card-label">{t('apply', 'yourApplicationNumber')}</span>
          <div className="status-card-number">{data.applicationNumber}</div>
        </div>

        <div className="status-card-row">
          <span className="status-card-row-label">{t('applications', 'service')}</span>
          <span className="status-card-row-value">
            {data.serviceCode && t('apply', data.serviceCode)}
          </span>
        </div>
        <div className="status-card-row">
          <span className="status-card-row-label">{t('applications', 'status')}</span>
          {data.status && (
            <span className={`pill ${statusPillClass}`}>
              {t('applications', data.status as any)}
            </span>
          )}
        </div>

        <div className="status-card-divider" />

        <div className="status-card-section-label">{t('applications', 'payment')}</div>
        {data.kind === 'visa' ? (
          <div className="apply-pay-hero">
            <div className="apply-pay-hero-label">{t('apply', 'paymentRequired')}</div>
            <div className="apply-pay-hero-sub">{t('apply', 'completePaymentToProceed')}</div>
            <a href={VISA_FIXED_PAYMENT_URL} target="_blank" rel="noreferrer">
              {t('apply', 'payNow')}
            </a>
          </div>
        ) : data.paymentUrl ? (
          <div className="apply-payment-link-card">
            <div className="apply-payment-link-row">
              <span className="apply-payment-link-url">{data.paymentUrl}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(data.paymentUrl!)
                  setCopied(true)
                }}
              >
                {copied ? t('apply', 'copiedLink') : t('apply', 'copyLink')}
              </button>
            </div>
            <a
              className="btn-orange apply-payment-open-btn"
              href={data.paymentUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t('apply', 'openPaymentPage')}
            </a>
          </div>
        ) : (
          <p className="apply-payment-not-ready">{t('apply', 'paymentLinkNotReady')}</p>
        )}
      </div>
    </>
  )
}
