import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'

vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }))
import { upload } from '@vercel/blob/client'
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))
// IELTS يجيب أسماء المستشارين النشطين لحقل واحد فيه — بدون هذا الـ stub يطيح
// بطلب fetch حقيقي وقت الاختبار
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))

import { ApplyForm } from './ApplyForm'

function renderForm() {
  return render(
    <LanguageProvider>
      <ApplyForm />
    </LanguageProvider>
  )
}

describe('ApplyForm', () => {
  function openCountryPicker() {
    fireEvent.click(screen.getByRole('button', { name: /^Country:/ }))
  }

  function pickCountry(name: string) {
    openCountryPicker()
    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: new RegExp(name) })
    )
  }

  it('shows the visa countries in a picker with the UK selected by default', () => {
    renderForm()
    const trigger = screen.getByRole('button', { name: 'Country: UK' })
    expect(trigger).toHaveTextContent('Student visa')
    openCountryPicker()
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(6)
    const list = within(screen.getByRole('listbox'))
    expect(list.getByRole('option', { name: /UK/ })).toHaveAttribute('aria-selected', 'true')
    expect(list.getByRole('option', { name: /USA/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('switches the country and the rendered fields, and resets the service answers', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'ali@example.com' } })
    expect(screen.getByLabelText(/Email/)).toHaveValue('ali@example.com')

    pickCountry('USA')

    expect(screen.getByRole('button', { name: 'Country: USA' })).toBeInTheDocument()
    // نموذج USA يسأل رقمين هاتف بدل واحد، عكس UK
    expect(screen.getByLabelText(/Primary phone/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toHaveValue('')
  })

  it('marks name and phone as required with a red asterisk', () => {
    renderForm()
    for (const label of [/Full name \(first \+ last\)/, /Phone number/]) {
      const field = screen.getByLabelText(label)
      expect(field).toBeRequired()
      expect(field.previousElementSibling?.querySelector('.apply-req')).toHaveTextContent('*')
    }
  })

  it('switches to the exam chips when the Exam tab is picked', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Exam' }))
    expect(screen.getByRole('button', { name: 'IELTS' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'TOEFL' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Country:/ })).not.toBeInTheDocument()
  })

  it('renders the short exam list once, with no duplicate chips and no scroll arrows', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Exam' }))
    expect(screen.getAllByRole('button', { name: 'IELTS' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'TOEFL' })).toHaveLength(1)
    expect(screen.queryByLabelText('Scroll back')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Scroll forward')).not.toBeInTheDocument()
  })

  it('switches exam service on chip click and back to the country picker on the Visa tab', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Exam' }))
    fireEvent.click(screen.getByRole('button', { name: 'TOEFL' }))
    expect(screen.getByRole('button', { name: 'TOEFL' })).toHaveClass('active')
    fireEvent.click(screen.getByRole('button', { name: 'Visa' }))
    expect(screen.getByRole('button', { name: 'Country: UK' })).toBeInTheDocument()
  })

  it('shows Your Information before the service content and Documents after the fields', () => {
    renderForm()
    const yourInfo = screen.getByText('Your Information')
    const documents = screen.getByText('Documents')
    expect(
      yourInfo.compareDocumentPosition(documents) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})

describe('ApplyForm when the send fails', () => {
  // الفورم فيه أكثر من خانة "Full name" حسب الخدمة — نقصد خانة المتقدّم نفسه
  const applicantName = () => document.getElementById('apply-name') as HTMLInputElement

  function fillAndSubmit() {
    renderForm()
    fireEvent.change(applicantName(), { target: { value: 'Omar Khalil' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Submit application' }).closest('form')!)
  }

  it('says it was not sent when the connection drops, and keeps what was typed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    fillAndSubmit()

    expect(
      await screen.findByText(
        'Your application was not sent. Your details are still here — try again.'
      )
    ).toBeInTheDocument()
    expect(applicantName()).toHaveValue('Omar Khalil')
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeEnabled()
  })

  it('says it was not sent when the server answers with an error page instead of JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON')
        },
      })
    )
    fillAndSubmit()

    expect(
      await screen.findByText(
        'Your application was not sent. Your details are still here — try again.'
      )
    ).toBeInTheDocument()
  })

  it('locks the button while sending, so a second tap cannot send a second application', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    fillAndSubmit()

    const button = await screen.findByRole('button', { name: 'Sending…' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    const applicationPosts = fetchMock.mock.calls.filter(([url]) => url === '/api/applications')
    expect(applicationPosts).toHaveLength(1)
  })
})

describe('ApplyForm limit message', () => {
  it('shows the limit message in Arabic on the Arabic screen, not an English sentence', async () => {
    document.cookie = 'app-language=ar; path=/'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ ok: false, errors: ['tooManySubmissions'] }),
      })
    )
    try {
      renderForm()
      fireEvent.submit(document.getElementById('apply-name')!.closest('form')!)
      expect(
        await screen.findByText('عدد الطلبات كبير الآن. يرجى المحاولة مرة أخرى بعد 10 دقائق.')
      ).toBeInTheDocument()
    } finally {
      document.cookie = 'app-language=; path=/; max-age=0'
    }
  })
})

describe('ApplyForm document uploads', () => {
  const uploadMock = vi.mocked(upload)

  function mockSubmitOk() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (typeof url === 'string' && url === '/api/applications') {
          return {
            ok: true,
            json: async () => ({ ok: true, applicationId: 'app-1', applicationNumber: 'IELTS-1' }),
          }
        }
        return { ok: true, json: async () => [] }
      }) as any
    )
  }

  async function submitIeltsWithTwoFiles() {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Exam' }))
    const file = (name: string) => new File(['x'], name, { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/Passport copy/), {
      target: { files: [file('passport.pdf')] },
    })
    fireEvent.change(screen.getByLabelText(/UPay invoice/), {
      target: { files: [file('invoice.pdf')] },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Submit application' }).closest('form')!)
    await screen.findByText(/IELTS-1/)
  }

  beforeEach(() => {
    uploadMock.mockReset()
    mockSubmitOk()
  })

  it('says nothing about uploads when every file went through', async () => {
    uploadMock.mockResolvedValue({} as any)
    await submitIeltsWithTwoFiles()
    expect(uploadMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('tells the client which file failed instead of hiding it', async () => {
    uploadMock.mockResolvedValueOnce({} as any).mockRejectedValueOnce(new Error('network'))
    await submitIeltsWithTwoFiles()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('1 of 2 files did not upload')
    expect(within(alert).getByText('UPay invoice')).toBeInTheDocument()
    expect(within(alert).getByText('Failed')).toBeInTheDocument()
    expect(within(alert).getByText('Uploaded')).toBeInTheDocument()
    // الطلب نفسه محفوظ — الرقم يظل ظاهر للعميل
    expect(screen.getByText('IELTS-1')).toBeInTheDocument()
  })

  it('keeps uploading the rest after one file fails', async () => {
    uploadMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({} as any)
    await submitIeltsWithTwoFiles()
    expect(uploadMock).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('alert')).toHaveTextContent('1 of 2 files did not upload')
  })

  it('retries only the failed file, and clears the warning once it works', async () => {
    uploadMock.mockResolvedValueOnce({} as any).mockRejectedValueOnce(new Error('network'))
    await submitIeltsWithTwoFiles()
    uploadMock.mockReset()
    uploadMock.mockResolvedValue({} as any)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(uploadMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(uploadMock.mock.calls[0][2].clientPayload as string).documentLabel).toBe(
      'UPay invoice'
    )
  })

  it('keeps the warning when the retry fails too', async () => {
    uploadMock.mockRejectedValue(new Error('network'))
    await submitIeltsWithTwoFiles()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('2 of 2 files did not upload')
    )
  })
})
