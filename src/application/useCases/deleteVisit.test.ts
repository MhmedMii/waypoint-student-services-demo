import { describe, it, expect } from 'vitest'
import { deleteVisit } from './deleteVisit'
import { createFakeVisitRepository } from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'

const visit: Visit = {
  id: 'v1',
  type: 'new',
  name: 'Client',
  phone: '56012345',
  desiredCountry: 'US',
  counselorId: null,
  linkedVisitId: null,
  status: 'next',
  studentStatus: 'waiting',
  pickedUpAt: null,
  closedAt: null,
  followUpDueAt: null,
  createdBy: 'staff',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('deleteVisit', () => {
  it('removes the visit, as super_admin', async () => {
    const visitRepository = createFakeVisitRepository([visit])
    const result = await deleteVisit('super_admin', 'v1', { visitRepository })
    expect(result.ok).toBe(true)
    expect(await visitRepository.findById('v1')).toBeNull()
  })

  it('rejects as admin', async () => {
    const visitRepository = createFakeVisitRepository([visit])
    const result = await deleteVisit('admin', 'v1', { visitRepository })
    expect(result.ok).toBe(false)
    expect(await visitRepository.findById('v1')).not.toBeNull()
  })
})
