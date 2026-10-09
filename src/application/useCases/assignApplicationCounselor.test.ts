import { describe, it, expect } from 'vitest'
import { assignApplicationCounselor } from './assignApplicationCounselor'
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

describe('assignApplicationCounselor', () => {
  it('assigns a counselor', async () => {
    const applicationRepository = createFakeApplicationRepository([makeApp()])
    const result = await assignApplicationCounselor('super_admin', [], 'a1', 'c1', {
      applicationRepository,
    })
    expect(result.ok).toBe(true)
    const updated = await applicationRepository.findById('a1')
    expect(updated?.counselorId).toBe('c1')
  })

  it('unassigns when counselorId is null', async () => {
    const applicationRepository = createFakeApplicationRepository([makeApp({ counselorId: 'c1' })])
    const result = await assignApplicationCounselor('super_admin', [], 'a1', null, {
      applicationRepository,
    })
    expect(result.ok).toBe(true)
    const updated = await applicationRepository.findById('a1')
    expect(updated?.counselorId).toBeNull()
  })

  it('rejects an unauthorized actor', async () => {
    const applicationRepository = createFakeApplicationRepository([makeApp()])
    const result = await assignApplicationCounselor('admin', [], 'a1', 'c1', {
      applicationRepository,
    })
    expect(result.ok).toBe(false)
  })
})
