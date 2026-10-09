// src/app/intake/IntakeForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { IntakeForm } from './IntakeForm'

function mockFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/counselors/active') {
      return Promise.resolve({
        json: async () => [
          { id: 'demoCounselorOne', name: 'Demo Counselor One' },
          { id: 'omar', name: 'Demo Counselor Eight' },
        ],
      })
    }
    return Promise.resolve({ json: async () => ({ ok: true, visitId: 'v1', ...overrides }) })
  }) as any
}

function renderIntakeForm(onSubmitted = vi.fn()) {
  return render(
    <LanguageProvider>
      <IntakeForm onSubmitted={onSubmitted} />
    </LanguageProvider>
  )
}

describe('IntakeForm', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('submits the New client tab with name, phone, and country', async () => {
    const onSubmitted = vi.fn()
    global.fetch = mockFetch()

    renderIntakeForm(onSubmitted)
    fireEvent.click(screen.getByText('New client'))
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Demo Student One' } })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '56012345' } })
    fireEvent.change(screen.getByLabelText(/Desired country/i), { target: { value: 'USA' } })
    fireEvent.click(screen.getByText('Submit'))

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/visits/new',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows the locked queue screen with the assigned counselor after New client submission', async () => {
    const onSubmitted = vi.fn()
    global.fetch = mockFetch({ counselorName: 'Demo Counselor Eight' })

    renderIntakeForm(onSubmitted)
    fireEvent.click(screen.getByText('New client'))
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Demo Student One' } })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '56012345' } })
    fireEvent.click(screen.getByText('Submit'))

    await waitFor(() => expect(screen.getByText('Demo Counselor Eight')).toBeInTheDocument())
    expect(screen.getByText('people ahead of you')).toBeInTheDocument()
  })

  it('shows the Desired country field only on the New client tab', () => {
    global.fetch = mockFetch()
    renderIntakeForm()
    fireEvent.click(screen.getByText('Follow up'))
    expect(screen.queryByLabelText(/Desired country/i)).not.toBeInTheDocument()
  })

  it('populates the Counselor dropdown from /api/counselors/active on the Follow up tab', async () => {
    global.fetch = mockFetch()
    renderIntakeForm()

    fireEvent.click(screen.getByText('Follow up'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/counselors/active'))
    const select = await screen.findByLabelText('Counselor')
    expect(select.tagName).toBe('SELECT')
    expect(screen.getByRole('option', { name: 'Demo Counselor One' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Demo Counselor Eight' })).toBeInTheDocument()
  })

  it('shows a duplicate warning with an override link, and resubmits with overrideDuplicate on click', async () => {
    const onSubmitted = vi.fn()
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ ok: false, errors: ['duplicateVisitPending'] }),
      })
      .mockResolvedValueOnce({ json: async () => ({ ok: true, visitId: 'v1' }) }) as any

    renderIntakeForm(onSubmitted)
    fireEvent.click(screen.getByText('New client'))
    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: 'Fictional Student B' },
    })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '56012345' } })
    fireEvent.click(screen.getByText('Submit'))

    const overrideLink = await screen.findByText(/Continue anyway/)
    fireEvent.click(overrideLink)

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
    const secondCallBody = JSON.parse((global.fetch as any).mock.calls[1][1].body)
    expect(secondCallBody.overrideDuplicate).toBe(true)
  })

  it('disables the Submit button while a submission is in flight', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    ) as any

    renderIntakeForm()
    fireEvent.click(screen.getByText('New client'))
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Demo Student One' } })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '56012345' } })
    fireEvent.click(screen.getByText('Submit'))

    await waitFor(() => expect(screen.getByText('Submit')).toBeDisabled())
    resolveFetch({ json: async () => ({ ok: true, visitId: 'v1' }) })
  })

  describe('when the send fails', () => {
    function fillAndSubmit() {
      renderIntakeForm()
      fireEvent.click(screen.getByText('New client'))
      fireEvent.change(screen.getByLabelText(/Full name/i), {
        target: { value: 'Fictional Student P' },
      })
      fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '50000003' } })
      fireEvent.click(screen.getByText('Submit'))
    }

    it('says it was not sent when the connection drops, and keeps what was typed', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as any
      fillAndSubmit()

      expect(
        await screen.findByText('Not sent. Your details are still here — try again.')
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/Full name/i)).toHaveValue('Fictional Student P')
      expect(screen.getByLabelText(/Phone number/i)).toHaveValue('50000003')
      expect(screen.getByText('Submit')).toBeEnabled()
    })

    it('says it was not sent when the server answers with an error page instead of JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON')
        },
      }) as any
      fillAndSubmit()

      expect(
        await screen.findByText('Not sent. Your details are still here — try again.')
      ).toBeInTheDocument()
    })

    it('shows the message instead of crashing when a refusal carries no error list', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ ok: false }),
      }) as any
      fillAndSubmit()

      expect(
        await screen.findByText('Not sent. Your details are still here — try again.')
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/Full name/i)).toHaveValue('Fictional Student P')
    })
    it('shows the limit message in Arabic on the Arabic screen, not an English sentence', async () => {
      document.cookie = 'app-language=ar; path=/'
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ ok: false, errors: ['tooManySubmissionsFromNumber'] }),
      }) as any
      try {
        renderIntakeForm()
        fireEvent.change(await screen.findByLabelText(/الاسم الكامل/), {
          target: { value: 'سارة يوسف' },
        })
        fireEvent.change(screen.getByLabelText('رقم الهاتف'), { target: { value: '50000004' } })
        fireEvent.click(screen.getByText('إرسال'))

        expect(
          await screen.findByText(
            'استُخدم رقم الهاتف هذا مرات كثيرة خلال وقت قصير. يرجى المحاولة مرة أخرى بعد 15 دقيقة.'
          )
        ).toBeInTheDocument()
      } finally {
        document.cookie = 'app-language=; path=/; max-age=0'
      }
    })
  })

  describe('the Follow up counselor list', () => {
    function counselorsReply(reply: () => Promise<unknown>) {
      return vi
        .fn()
        .mockImplementation((url: string) =>
          url === '/api/counselors/active'
            ? reply()
            : Promise.resolve({ json: async () => ({ ok: true, visitId: 'v1' }) })
        ) as any
    }

    it('says the list could not be loaded when the request fails', async () => {
      global.fetch = counselorsReply(() => Promise.reject(new TypeError('Failed to fetch')))
      renderIntakeForm()
      fireEvent.click(screen.getByText('Follow up'))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Couldn't load the counselor list — please ask at the desk."
      )
    })

    it('treats a refusal that is not a list as a failure, not as nobody signed in', async () => {
      global.fetch = counselorsReply(() =>
        Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
      )
      renderIntakeForm()
      fireEvent.click(screen.getByText('Follow up'))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Couldn't load the counselor list — please ask at the desk."
      )
    })

    it('says nobody is available when the list loads empty', async () => {
      global.fetch = counselorsReply(() => Promise.resolve({ ok: true, json: async () => [] }))
      renderIntakeForm()
      fireEvent.click(screen.getByText('Follow up'))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No counselor is available right now — please ask at the desk.'
      )
    })

    it('shows no message when counselors load', async () => {
      global.fetch = mockFetch()
      renderIntakeForm()
      fireEvent.click(screen.getByText('Follow up'))

      await screen.findByRole('option', { name: 'Demo Counselor One' })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('keeps the names from an earlier load when a later reload fails', async () => {
      global.fetch = mockFetch()
      renderIntakeForm()
      fireEvent.click(screen.getByText('Follow up'))
      await screen.findByRole('option', { name: 'Demo Counselor One' })

      global.fetch = counselorsReply(() => Promise.reject(new TypeError('Failed to fetch')))
      fireEvent.click(screen.getByText('New client'))
      fireEvent.click(screen.getByText('Follow up'))

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/counselors/active'))
      expect(screen.getByRole('option', { name: 'Demo Counselor One' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('renders Arabic strings when the persisted language is ar', async () => {
    document.cookie = 'app-language=ar; path=/'
    global.fetch = mockFetch()
    renderIntakeForm()

    await waitFor(() => expect(screen.getByText('عميل جديد')).toBeInTheDocument())
    expect(screen.getByText('متابعة')).toBeInTheDocument()
    expect(screen.getByLabelText('رقم الهاتف')).toBeInTheDocument()
    expect(screen.getByText('إرسال')).toBeInTheDocument()

    // خيار الفئة يترجم للعرض بس، والـ value المُرسلة تضل ثابتة بالإنجليزي
    const gccOption = screen.getByRole('option', { name: 'دول الخليج' }) as HTMLOptionElement
    expect(gccOption.value).toBe('GCC')
    const europeOption = screen.getByRole('option', {
      name: 'أوروبا ودول أخرى',
    }) as HTMLOptionElement
    expect(europeOption.value).toBe('Europe & Other Countries')
  })
})
