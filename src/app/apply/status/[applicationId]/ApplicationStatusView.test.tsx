import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../../../../i18n/LanguageContext'
import { ApplicationStatusView } from './ApplicationStatusView'

function renderView() {
  return render(
    <LanguageProvider>
      <ApplicationStatusView applicationId="app-1" />
    </LanguageProvider>
  )
}

const REAL_STATUS = {
  ok: true,
  applicationNumber: 'V-1042',
  kind: 'visa',
  serviceCode: 'schengen_visit',
  status: 'under_review',
  paymentUrl: null,
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ApplicationStatusView', () => {
  it('shows the application once it loads', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => REAL_STATUS }) as any
    renderView()
    expect(await screen.findByText('V-1042')).toBeInTheDocument()
  })

  // البق: انقطاع شبكة كان يقول للعميل إن طلبه غير موجود
  it('does not tell the client their application is missing when the network fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as any
    renderView()

    expect(await screen.findByText(/could not reach your application/i)).toBeInTheDocument()
    expect(screen.queryByText(/could not find that application/i)).not.toBeInTheDocument()
  })

  it('offers a retry when it could not reach the server', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as any
    renderView()
    expect(await screen.findByText('Try again')).toBeInTheDocument()
  })

  // "ما فيه طلب بهذا الرقم" جواب حقيقي من السيرفر — هذا وحده يستحق العبارة
  it('still says not found when the server actually says so', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false }) }) as any
    renderView()
    expect(await screen.findByText(/could not find that application/i)).toBeInTheDocument()
  })

  it('treats a 500 as unreachable, not as missing', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as any
    renderView()
    expect(await screen.findByText(/could not reach your application/i)).toBeInTheDocument()
  })

  it('says it is loading rather than showing a blank page', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as any
    renderView()
    expect(await screen.findByText('Loading…')).toBeInTheDocument()
  })

  // تكة فاشلة وحدة ما تمسح صفحة صحيحة
  it('keeps the loaded application on screen when a later refresh fails', async () => {
    let call = 0
    global.fetch = vi.fn().mockImplementation(() => {
      call += 1
      if (call === 1) return Promise.resolve({ ok: true, json: async () => REAL_STATUS })
      return Promise.reject(new Error('offline'))
    }) as any

    const { rerender } = renderView()
    expect(await screen.findByText('V-1042')).toBeInTheDocument()

    // نجبر جولة ثانية بإعادة التركيب — التكة الدورية تفعل نفس الشي
    rerender(
      <LanguageProvider>
        <ApplicationStatusView applicationId="app-1" />
      </LanguageProvider>
    )
    await waitFor(() => expect(screen.getByText('V-1042')).toBeInTheDocument())
  })
})
