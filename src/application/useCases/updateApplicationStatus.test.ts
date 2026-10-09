import { describe, it, expect } from 'vitest'
import { updateApplicationStatus } from './updateApplicationStatus'
import { createFakeApplicationRepository } from '../testing/fakes'
import type { Application } from '../../domain/entities/application'

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
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
    ...overrides,
  }
}

describe('updateApplicationStatus', () => {
  it('allows a legal transition and persists it', async () => {
    const applicationRepository = createFakeApplicationRepository([makeApp()])
    const result = await updateApplicationStatus(
      'super_admin',
      [],
      'a1',
      'under_review',
      null,
      null,
      { applicationRepository }
    )
    expect(result.ok).toBe(true)
    const updated = await applicationRepository.findById('a1')
    expect(updated?.status).toBe('under_review')
  })

  it('rejects an illegal transition before touching the repository', async () => {
    const applicationRepository = createFakeApplicationRepository([makeApp()])
    const result = await updateApplicationStatus(
      'super_admin',
      [],
      'a1',
      'approved',
      null,
      'REF-1',
      { applicationRepository }
    )
    expect(result.ok).toBe(false)
    const updated = await applicationRepository.findById('a1')
    expect(updated?.status).toBe('pending')
  })

  it('rejects moving to documents_requested without a statusNote', async () => {
    const applicationRepository = createFakeApplicationRepository([
      makeApp({ status: 'under_review' }),
    ])
    const result = await updateApplicationStatus(
      'super_admin',
      [],
      'a1',
      'documents_requested',
      null,
      null,
      { applicationRepository }
    )
    expect(result.ok).toBe(false)
  })

  it('rejects moving to approved without a referenceNumber', async () => {
    const applicationRepository = createFakeApplicationRepository([
      makeApp({ status: 'submitted_to_source' }),
    ])
    const result = await updateApplicationStatus('super_admin', [], 'a1', 'approved', null, null, {
      applicationRepository,
    })
    expect(result.ok).toBe(false)
  })

  it('allows approved with both a statusNote absent and a referenceNumber present', async () => {
    const applicationRepository = createFakeApplicationRepository([
      makeApp({ status: 'submitted_to_source' }),
    ])
    const result = await updateApplicationStatus(
      'super_admin',
      [],
      'a1',
      'approved',
      null,
      'REF-123',
      { applicationRepository }
    )
    expect(result.ok).toBe(true)
  })

  it('requires both statusNote and referenceNumber for rejected', async () => {
    const applicationRepository = createFakeApplicationRepository([
      makeApp({ status: 'submitted_to_source' }),
    ])
    const missingBoth = await updateApplicationStatus(
      'super_admin',
      [],
      'a1',
      'rejected',
      null,
      null,
      { applicationRepository }
    )
    expect(missingBoth.ok).toBe(false)

    const missingRef = await updateApplicationStatus(
      'super_admin',
      [],
      'a1',
      'rejected',
      'Not eligible',
      null,
      { applicationRepository }
    )
    expect(missingRef.ok).toBe(false)

    const complete = await updateApplicationStatus(
      'super_admin',
      [],
      'a1',
      'rejected',
      'Not eligible',
      'REF-9',
      { applicationRepository }
    )
    expect(complete.ok).toBe(true)
  })

  it('rejects an unauthorized counselor (wrong scope)', async () => {
    const applicationRepository = createFakeApplicationRepository([makeApp()])
    const result = await updateApplicationStatus(
      'counselor',
      ['exam_services'],
      'a1',
      'under_review',
      null,
      null,
      { applicationRepository }
    )
    expect(result.ok).toBe(false)
  })

  it('rejects an admin actor regardless of scopes', async () => {
    const applicationRepository = createFakeApplicationRepository([makeApp()])
    const result = await updateApplicationStatus(
      'admin',
      ['visa_services'],
      'a1',
      'under_review',
      null,
      null,
      { applicationRepository }
    )
    expect(result.ok).toBe(false)
  })

  it('returns not found for a missing application', async () => {
    const applicationRepository = createFakeApplicationRepository([])
    const result = await updateApplicationStatus(
      'super_admin',
      [],
      'nope',
      'under_review',
      null,
      null,
      { applicationRepository }
    )
    expect(result.ok).toBe(false)
  })
})
