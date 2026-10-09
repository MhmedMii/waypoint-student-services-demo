import { describe, it, expect } from 'vitest'
import type { Application } from '../../domain/entities/application'
import type { ApplicationDocument } from '../../domain/entities/applicationDocument'
import {
  createFakeApplicationRepository,
  createFakeApplicationDocumentRepository,
} from '../testing/fakes'
import { listApplicationsWithDocumentState } from './listApplicationsWithDocumentState'

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    applicationNumber: 'IELTS-0001',
    kind: 'exam',
    serviceCode: 'ielts',
    name: 'Fictional Student J',
    phone: '51000001',
    email: null,
    fields: {},
    status: 'pending',
    statusNote: null,
    referenceNumber: null,
    counselorId: null,
    paymentUrl: null,
    acceptedAt: null,
    closedAt: null,
    createdAt: new Date('2026-09-20T09:00:00Z'),
    updatedAt: new Date('2026-09-20T09:00:00Z'),
    ...overrides,
  }
}

function document(applicationId: string, documentLabel: string | null): ApplicationDocument {
  return {
    id: `doc-${applicationId}-${documentLabel}`,
    applicationId,
    blobPathname: 'x',
    originalFileName: 'x.pdf',
    documentLabel,
    contentType: 'application/pdf',
    sizeBytes: 10,
    uploadedAt: new Date(),
  }
}

async function run(applications: Application[], documents: ApplicationDocument[]) {
  const result = await listApplicationsWithDocumentState('super_admin', [], 'exam', {
    applicationRepository: createFakeApplicationRepository(applications),
    applicationDocumentRepository: createFakeApplicationDocumentRepository(documents),
  })
  if (!result.ok) throw new Error(result.reason)
  return result.applications
}

// IELTS يطلب مستندين إجباريين: نسخة الجواز وفاتورة يوباي
describe('listApplicationsWithDocumentState', () => {
  it('flags an application whose upload silently failed', async () => {
    const [row] = await run([application()], [document('a1', 'Passport copy')])
    expect(row.missingDocuments).toEqual(['UPay invoice'])
    expect(row.requiredDocumentCount).toBe(2)
    expect(row.uploadedRequiredCount).toBe(1)
  })

  it('flags an application with no documents at all', async () => {
    const [row] = await run([application()], [])
    expect(row.missingDocuments).toEqual(['Passport copy', 'UPay invoice'])
    expect(row.uploadedRequiredCount).toBe(0)
  })

  it('marks a complete application as nothing missing', async () => {
    const [row] = await run(
      [application()],
      [document('a1', 'Passport copy'), document('a1', 'UPay invoice')]
    )
    expect(row.missingDocuments).toEqual([])
    expect(row.uploadedRequiredCount).toBe(2)
  })

  it('does not mix up documents belonging to different applications', async () => {
    const rows = await run(
      [application({ id: 'a1' }), application({ id: 'a2', applicationNumber: 'IELTS-0002' })],
      [
        document('a1', 'Passport copy'),
        document('a1', 'UPay invoice'),
        document('a2', 'Passport copy'),
      ]
    )
    expect(rows.find((r) => r.id === 'a1')!.missingDocuments).toEqual([])
    expect(rows.find((r) => r.id === 'a2')!.missingDocuments).toEqual(['UPay invoice'])
  })

  it('keeps the original application fields on every row', async () => {
    const [row] = await run([application()], [])
    expect(row.applicationNumber).toBe('IELTS-0001')
    expect(row.name).toBe('Fictional Student J')
  })

  it('reports nothing missing for a service whose schema no longer exists', async () => {
    const [row] = await run([application({ serviceCode: 'retired-service' as any })], [])
    expect(row.missingDocuments).toEqual([])
    expect(row.requiredDocumentCount).toBe(0)
  })

  it('refuses a counselor without the exam scope', async () => {
    const result = await listApplicationsWithDocumentState('counselor', ['visa_services'], 'exam', {
      applicationRepository: createFakeApplicationRepository([application()]),
      applicationDocumentRepository: createFakeApplicationDocumentRepository([]),
    })
    expect(result).toEqual({ ok: false, reason: 'notAuthorizedScope' })
  })
})
