'use client'
import { useEffect, useState } from 'react'

interface QrPosterProps {
  path: string
  headline: string
  sub: string
  subAr: string
  caption?: string
  captionAr?: string
}

export function QrPoster({
  path,
  headline,
  sub,
  subAr,
  caption = 'Point your camera here',
  captionAr = 'وجّه كاميرا هاتفك هنا',
}: QrPosterProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then((QRCode) =>
        QRCode.default.toDataURL(`${window.location.origin}${path}`, { width: 640, margin: 1 })
      )
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  return (
    <div className="qr-poster-page">
      <div className="qr-poster">
        <div className="qr-poster-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="qr-poster-headline">{headline}</p>
        <p className="qr-poster-sub">
          {sub}
          <span className="qr-poster-ar">{subAr}</span>
        </p>
        <div className="qr-poster-card">{qrDataUrl && <img src={qrDataUrl} alt="QR code" />}</div>
        <p className="qr-poster-caption">
          {caption}
          <span className="qr-poster-ar">{captionAr}</span>
        </p>
      </div>
      <button
        type="button"
        className="btn-orange qr-poster-print-btn"
        onClick={() => window.print()}
      >
        Print
      </button>
    </div>
  )
}
