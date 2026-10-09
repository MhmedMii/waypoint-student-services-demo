import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { DynamicServiceFields } from './DynamicServiceFields'
import type { ServiceFormSchema } from '../domain/entities/applicationFieldSchema'
import { field } from '../domain/entities/applicationFieldSchema'

function noop() {}

function renderFields(schema: ServiceFormSchema) {
  return render(
    <LanguageProvider>
      <DynamicServiceFields
        schema={schema}
        values={{}}
        onChange={noop}
        repeatValues={{}}
        onRepeatChange={noop}
        documentFiles={{}}
        onDocumentChange={noop}
      />
    </LanguageProvider>
  )
}

describe('DynamicServiceFields', () => {
  it('renders fields before the Documents section, with a header', () => {
    const schema: ServiceFormSchema = {
      serviceCode: 'ielts',
      documents: [
        { id: 'passport-copy', label: 'Passport copy', labelAr: 'نسخة جواز السفر', required: true },
      ],
      fields: [
        field({
          id: 'email',
          type: 'email',
          label: 'Email',
          labelAr: 'البريد الإلكتروني',
          required: true,
        }),
      ],
    }
    renderFields(schema)

    expect(screen.getByText('Documents')).toBeInTheDocument()
    const emailLabel = screen.getByText('Email')
    const documentsHeader = screen.getByText('Documents')
    expect(
      emailLabel.compareDocumentPosition(documentsHeader) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('does not show a Documents header when the schema has no top-level documents', () => {
    const schema: ServiceFormSchema = {
      serviceCode: 'ielts',
      documents: [],
      fields: [
        field({
          id: 'email',
          type: 'email',
          label: 'Email',
          labelAr: 'البريد الإلكتروني',
          required: true,
        }),
      ],
    }
    renderFields(schema)
    expect(screen.queryByText('Documents')).not.toBeInTheDocument()
  })

  it('still renders a conditional document right after its triggering field, not under the Documents header', () => {
    const schema: ServiceFormSchema = {
      serviceCode: 'uk-student',
      documents: [
        { id: 'passport-copy', label: 'Passport copy', labelAr: 'نسخة جواز السفر', required: true },
        {
          id: 'bank-statement',
          label: 'Bank statement',
          labelAr: 'كشف حساب بنكي',
          required: true,
          visibleWhen: { fieldId: 'proof-of-finance', equals: 'Self-Funded' },
        },
      ],
      fields: [
        field({
          id: 'proof-of-finance',
          type: 'select',
          label: 'Proof of finance',
          labelAr: 'إثبات الملاءة المالية',
          required: false,
          options: ['Select...', 'Self-Funded', 'Sponsor'],
          optionsAr: ['اختر...', 'تمويل ذاتي', 'كفيل'],
          defaultValue: 'Self-Funded',
        }),
      ],
    }
    renderFields(schema)

    const proofLabel = screen.getByText('Proof of finance')
    const bankStatementLabel = screen.getByText('Bank statement')
    const documentsHeader = screen.getByText('Documents')
    // بيان البنك يرتبط بسؤال إثبات التمويل مباشرة — يظهر بعده بالترتيب، قبل
    // قسم "المستندات" اللي فيه بس جواز السفر (المستند غير المشروط)
    expect(
      proofLabel.compareDocumentPosition(bankStatementLabel) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      bankStatementLabel.compareDocumentPosition(documentsHeader) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
describe('DynamicServiceFields counselor list (IELTS)', () => {
  const schemaWithCounselor = (): ServiceFormSchema => ({
    serviceCode: 'ielts',
    documents: [],
    fields: [
      field({
        id: 'counselor-name',
        type: 'select',
        label: 'Counselor',
        labelAr: 'المستشار',
        required: false,
        optionsSource: 'activeCounselors',
      }),
    ],
  })
  const FAILED = "Couldn't load the counselor list. You can leave this blank and still apply."
  const NONE = 'No counselor is available right now. You can leave this blank and still apply.'

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('says the list could not be loaded, and that the field can stay blank, when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    renderFields(schemaWithCounselor())
    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED)
  })

  it('treats an error page as a failed load', async () => {
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
    renderFields(schemaWithCounselor())
    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED)
  })

  it('treats a refusal that is not a list as a failed load, not as nobody available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'no' }) })
    )
    renderFields(schemaWithCounselor())
    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED)
  })

  it('says nobody is available when the list loads empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    renderFields(schemaWithCounselor())
    expect(await screen.findByRole('alert')).toHaveTextContent(NONE)
  })

  it('shows the names and no message when counselors load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 'c1', name: 'Fictional Student D' }],
      })
    )
    renderFields(schemaWithCounselor())
    expect(await screen.findByRole('option', { name: 'Fictional Student D' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the names from an earlier load when a later reload fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'c1', name: 'Fictional Student D' }],
      })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = renderFields(schemaWithCounselor())
    await screen.findByRole('option', { name: 'Fictional Student D' })

    // مخطط جديد (نفس الخدمة) يعيد التحميل — والتحميل الثاني يفشل
    rerender(
      <LanguageProvider>
        <DynamicServiceFields
          schema={schemaWithCounselor()}
          values={{}}
          onChange={noop}
          repeatValues={{}}
          onRepeatChange={noop}
          documentFiles={{}}
          onDocumentChange={noop}
        />
      </LanguageProvider>
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('option', { name: 'Fictional Student D' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('never asks for the list on a service without a counselor field', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderFields({ serviceCode: 'toefl', documents: [], fields: [] } as ServiceFormSchema)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
