import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { WalkInVisaPanel } from './WalkInVisaPanel'

// زر ✕ هنا نفس زر صفحة الزيارات — كان اسمه الوحيد tooltip
function mockVisaQueue() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/visits/type/visa') {
      return {
        ok: true,
        json: async () => [
          {
            id: 'wv1',
            type: 'visa',
            name: 'Fictional Student P',
            phone: '50000003',
            desiredCountry: null,
            status: 'next',
            studentStatus: null,
            counselorId: 'c1',
            counselorName: 'Fictional Student Q',
            counselorNameAr: null,
            createdAt: new Date().toISOString(),
            pickedUpAt: null,
            closedAt: null,
            note: null,
          },
        ],
      }
    }
    return { ok: true, json: async () => [] }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('WalkInVisaPanel unassign button', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('names the ✕ after the counselor it removes, and still unassigns', async () => {
    const fetchMock = mockVisaQueue()
    render(
      <LanguageProvider>
        <WalkInVisaPanel role="super_admin" />
      </LanguageProvider>
    )
    await screen.findByText('Fictional Student P')
    const row = screen.getByText('Fictional Student P').closest('tr')!

    fireEvent.click(within(row).getByRole('button', { name: 'Unassign Fictional Student Q' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/reassign',
        expect.objectContaining({ body: JSON.stringify({ visitId: 'wv1', counselorId: null }) })
      )
    )
  })
})
