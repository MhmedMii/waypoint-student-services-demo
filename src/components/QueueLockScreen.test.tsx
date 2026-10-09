import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { QueueLockScreen } from './QueueLockScreen'

function mockQueue(extra: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        position: 2,
        counselorName: 'Demo Counselor Eight',
        ...extra,
      }),
    })
  )
}

async function withPosition(position: number, language?: 'ar') {
  if (language) document.cookie = `app-language=${language}; path=/`
  mockQueue({ position, counselorShift: null })
  show()
  await waitFor(() => expect(screen.getByText('Demo Counselor Eight')).toBeInTheDocument())
  return document.querySelector('.queue-lock-sub')!.textContent
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function show() {
  render(
    <LanguageProvider>
      <QueueLockScreen
        visitId="v1"
        initialCounselorName="Demo Counselor Eight"
        onUnlocked={() => {}}
      />
    </LanguageProvider>
  )
}

describe('what the waiting client sees', () => {
  // ١٥:٠٠ = ٩٠٠ دقيقة، نفس الرقم اللي يقرر الظهور بالسيرفر
  it('tells them when the evening shift starts', async () => {
    mockQueue({ counselorShift: { shift: 'night', availableFromMinutes: 900 } })
    show()
    await waitFor(() => expect(screen.getByText('Demo Counselor Eight')).toBeInTheDocument())
    expect(screen.getByText('Evening shift — available from 3:00 PM')).toBeInTheDocument()
  })

  it('says nothing extra when the counselor is available now', async () => {
    mockQueue({ counselorShift: null })
    show()
    await waitFor(() => expect(screen.getByText('Demo Counselor Eight')).toBeInTheDocument())
    expect(screen.queryByText(/Evening shift/)).not.toBeInTheDocument()
  })

  // القاعدة: الزائر ما يُقال له شي عن حضور الموظفين
  it('never shows the client anything about absence', async () => {
    mockQueue({ counselorShift: { shift: 'night', availableFromMinutes: 900 } })
    show()
    await waitFor(() => expect(screen.getByText('Demo Counselor Eight')).toBeInTheDocument())
    expect(document.body.textContent).not.toMatch(/working day|not in|absent|signed in/i)
  })
})

describe('the same screen in Arabic', () => {
  it('names the evening shift and the time in Arabic', async () => {
    document.cookie = 'app-language=ar; path=/'
    mockQueue({ counselorShift: { shift: 'night', availableFromMinutes: 900 } })
    show()
    await waitFor(() => expect(screen.getByText('Demo Counselor Eight')).toBeInTheDocument())
    const line = document.querySelector('.queue-lock-shift')!
    expect(line.textContent).toContain('الدوام المسائي')
    expect(line.textContent).toMatch(/٣|3/)
  })
})

// الرقم يظهر فوق والمعدود تحته، فلازم يتصرّف معه
describe('the number of people ahead agrees with the word under it', () => {
  it('says person, not people, for one', async () => {
    expect(await withPosition(1)).toBe('person ahead of you')
  })

  it('says people for two', async () => {
    expect(await withPosition(2)).toBe('people ahead of you')
  })

  it('says people for none and for many', async () => {
    expect(await withPosition(0)).toBe('people ahead of you')
    cleanup()
    expect(await withPosition(12)).toBe('people ahead of you')
  })

  // العربي له أربع صيغ: مفرد، مثنى، جمع قلة، ثم مفرد منصوب من ١١
  it('uses the Arabic singular for one', async () => {
    expect(await withPosition(1, 'ar')).toBe('شخص قبلك')
  })

  it('uses the Arabic dual for two, not the plural', async () => {
    expect(await withPosition(2, 'ar')).toBe('شخصان قبلك')
  })

  it('uses the Arabic plural for three to ten', async () => {
    expect(await withPosition(5, 'ar')).toBe('أشخاص قبلك')
  })

  it('returns to the Arabic singular past ten', async () => {
    expect(await withPosition(12, 'ar')).toBe('شخصًا قبلك')
  })
})
