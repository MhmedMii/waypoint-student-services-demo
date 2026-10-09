'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Printer } from '@phosphor-icons/react'
import { PublicFrame } from './PublicFlows'
import { Brand } from './ui'
import { useDemo } from './DemoProvider'

export function Posters({ application }: { application: boolean }) {
  const { tr } = useDemo()
  const [qr, setQr] = useState('')
  useEffect(() => {
    let active = true
    import('qrcode')
      .then((module) =>
        module.default.toDataURL(`${window.location.origin}${application ? '/apply' : '/intake'}`, {
          width: 480,
          margin: 2,
          color: { dark: '#172522', light: '#FFFFFF' },
        })
      )
      .then((url) => {
        if (active) setQr(url)
      })
    return () => {
      active = false
    }
  }, [application])
  return (
    <PublicFrame>
      <section className="public-card qr-card">
        <Brand />
        <h1>
          {application
            ? tr('Your next chapter starts here.', 'فصلك التالي يبدأ هنا.')
            : tr('A clear next step.', 'خطوة تالية واضحة.')}
        </h1>
        <p>
          {tr(
            'Scan to explore a fictional student services demo.',
            'امسح لاستكشاف عرض وهمي لخدمات الطلاب.'
          )}
        </p>
        {qr && (
          <Image
            src={qr}
            width={240}
            height={240}
            unoptimized
            alt={tr('QR code for this fictional demo', 'رمز الاستجابة السريعة للعرض الوهمي')}
          />
        )}
        <p lang="ar">عرض تجريبي — جميع البيانات وهمية</p>
        <button className="button print-button" onClick={() => window.print()}>
          <Printer size={18} />
          {tr('Print demo poster', 'طباعة الملصق التجريبي')}
        </button>
      </section>
    </PublicFrame>
  )
}
