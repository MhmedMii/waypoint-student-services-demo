import { describe, it, expect } from 'vitest'
import { attachApplicationDocument } from './attachApplicationDocument'
import {
  createFakeApplicationRepository,
  createFakeApplicationDocumentRepository,
} from '../testing/fakes'
import type { Application } from '../../domain/entities/application'

const app: Application = {
  id: 'a1',
  applicationNumber: 'VISA-0001',
  kind: 'visa',
  serviceCode: 'uk-student',
  name: 'Fictional Student R',
  phone: '51234567',
  email: null,
  fields: {},
  status: 'pending',
  statusNote: null,
  referenceNumber: null,
  counselorId: null,
  paymentUrl: null,
  acceptedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('attachApplicationDocument', () => {
  it('creates a document row linked to an existing application', async () => {
    const applicationRepository = createFakeApplicationRepository([app])
    const applicationDocumentRepository = createFakeApplicationDocumentRepository()
    const result = await attachApplicationDocument(
      {
        applicationId: 'a1',
        blobPathname: 'docs/passport.pdf',
        originalFileName: 'passport.pdf',
        documentLabel: 'Passport copy',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      { applicationRepository, applicationDocumentRepository }
    )
    expect(result.ok).toBe(true)
    expect(await applicationDocumentRepository.findByApplicationId('a1')).toHaveLength(1)
  })

  it('rejects when the application does not exist', async () => {
    const applicationRepository = createFakeApplicationRepository([])
    const applicationDocumentRepository = createFakeApplicationDocumentRepository()
    const result = await attachApplicationDocument(
      {
        applicationId: 'nope',
        blobPathname: 'docs/passport.pdf',
        originalFileName: 'passport.pdf',
        documentLabel: 'Passport copy',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      { applicationRepository, applicationDocumentRepository }
    )
    expect(result.ok).toBe(false)
  })
})
