import { describe, it, expect } from 'vitest'
import { listApplicationsForScope } from './listApplicationsForScope'
import { createFakeApplicationRepository } from '../testing/fakes'
import type { Application } from '../../domain/entities/application'

const visaApp: Application = {
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
const examApp: Application = { ...visaApp, id: 'a2', kind: 'exam', serviceCode: 'ielts' }

describe('listApplicationsForScope', () => {
  it('super_admin sees all applications of the requested kind', async () => {
    const applicationRepository = createFakeApplicationRepository([visaApp, examApp])
    const result = await listApplicationsForScope('super_admin', [], 'visa', {
      applicationRepository,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.applications).toEqual([visaApp])
  })

  it('counselor with matching scope sees the list', async () => {
    const applicationRepository = createFakeApplicationRepository([visaApp])
    const result = await listApplicationsForScope('counselor', ['visa_services'], 'visa', {
      applicationRepository,
    })
    expect(result.ok).toBe(true)
  })

  it('counselor without matching scope is rejected', async () => {
    const applicationRepository = createFakeApplicationRepository([visaApp])
    const result = await listApplicationsForScope('counselor', ['exam_services'], 'visa', {
      applicationRepository,
    })
    expect(result.ok).toBe(false)
  })

  it('admin role is always rejected regardless of scopes', async () => {
    const applicationRepository = createFakeApplicationRepository([visaApp])
    const result = await listApplicationsForScope(
      'admin',
      ['visa_services', 'exam_services'],
      'visa',
      { applicationRepository }
    )
    expect(result.ok).toBe(false)
  })
})
