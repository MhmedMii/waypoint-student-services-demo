'use client'
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

export function ApplyQrPoster() {
  const { t } = useLanguage()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then((QRCode) =>
        QRCode.default.toDataURL(`${window.location.origin}/apply`, { width: 640, margin: 1 })
      )
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="apply-qr-poster-page">
      <div className="apply-qr-poster">
        <div className="apply-qr-poster-header">
          <span className="apply-qr-poster-line" />
          <div className="apply-qr-poster-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="apply-qr-poster-line" />
        </div>
        <div className="apply-qr-poster-kicker">
          <span>Scan to Apply</span>
          <span className="apply-qr-poster-kicker-ar">امسح للتقديم</span>
        </div>
        <div className="apply-qr-poster-qr">
          {qrDataUrl && <img src={qrDataUrl} alt="Apply QR code" />}
        </div>
        <div className="apply-qr-poster-footer">
          <span>Visa &amp; Exam</span>
          <span className="apply-qr-poster-footer-ar">تأشيرة واختبار</span>
        </div>
      </div>
      <button
        type="button"
        className="btn-orange apply-qr-poster-print-btn"
        onClick={() => window.print()}
      >
        {t('common', 'print')}
      </button>
    </div>
  )
}
