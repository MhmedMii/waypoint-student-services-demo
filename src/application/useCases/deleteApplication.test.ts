import { describe, it, expect } from 'vitest'
import { deleteApplication } from './deleteApplication'
import { createFakeApplicationRepository } from '../testing/fakes'
import type { Application } from '../../domain/entities/application'

const application: Application = {
  id: 'a1',
  applicationNumber: 'VISA-0001',
  kind: 'visa',
  serviceCode: 'uk-student',
  name: 'Client',
  phone: '56012345',
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

describe('deleteApplication', () => {
  it('removes the application, as super_admin', async () => {
    const applicationRepository = createFakeApplicationRepository([application])
    const result = await deleteApplication('super_admin', 'a1', { applicationRepository })
    expect(result.ok).toBe(true)
    expect(await applicationRepository.findById('a1')).toBeNull()
  })

  it('rejects as admin', async () => {
    const applicationRepository = createFakeApplicationRepository([application])
    const result = await deleteApplication('admin', 'a1', { applicationRepository })
    expect(result.ok).toBe(false)
    expect(await applicationRepository.findById('a1')).not.toBeNull()
  })

  it('rejects as counselor, even with matching scope', async () => {
    const applicationRepository = createFakeApplicationRepository([application])
    const result = await deleteApplication('counselor', 'a1', { applicationRepository })
    expect(result.ok).toBe(false)
    expect(await applicationRepository.findById('a1')).not.toBeNull()
  })
})
