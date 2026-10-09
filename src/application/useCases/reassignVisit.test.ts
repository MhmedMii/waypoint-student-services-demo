import { describe, it, expect } from 'vitest'
import { reassignVisit } from './reassignVisit'
import { createFakeVisitRepository } from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'

const unassigned: Visit = {
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

describe('reassignVisit', () => {
  it('sets a new counselor, as super_admin', async () => {
    const visitRepository = createFakeVisitRepository([unassigned])
    const result = await reassignVisit('super_admin', 'v1', 'demoCounselorOne', { visitRepository })
    expect(result.ok).toBe(true)
    const updated = await visitRepository.findById('v1')
    expect(updated?.counselorId).toBe('demoCounselorOne')
  })

  it('clears the counselor when passed null', async () => {
    const assigned: Visit = { ...unassigned, counselorId: 'demoCounselorOne' }
    const visitRepository = createFakeVisitRepository([assigned])
    const result = await reassignVisit('super_admin', 'v1', null, { visitRepository })
    expect(result.ok).toBe(true)
    const updated = await visitRepository.findById('v1')
    expect(updated?.counselorId).toBeNull()
  })

  it('rejects as admin', async () => {
    const visitRepository = createFakeVisitRepository([unassigned])
    const result = await reassignVisit('admin', 'v1', 'demoCounselorOne', { visitRepository })
    expect(result.ok).toBe(false)
  })

  // DEMO انقفلت زيارته وبقيت حالة الطالب "بالجلسة" — إعادة التعيين وحدة من
  // الطرق اللي شككنا فيها، فنثبّت بتست إنها ما تلمس أي حالة
  it("leaves a closed visit's two statuses alone", async () => {
    const closedVisit: Visit = {
      ...unassigned,
      id: 'v2',
      type: 'visa',
      counselorId: 'old-counselor',
      status: 'closed',
      studentStatus: 'closed',
      pickedUpAt: new Date('2026-08-31T09:56:52Z'),
      closedAt: new Date('2026-08-31T09:56:55Z'),
    }
    const visitRepository = createFakeVisitRepository([closedVisit])

    await reassignVisit('super_admin', 'v2', 'demoCounselorOne', { visitRepository })

    const updated = await visitRepository.findById('v2')
    expect(updated?.counselorId).toBe('demoCounselorOne')
    expect(updated?.status).toBe('closed')
    expect(updated?.studentStatus).toBe('closed')
    expect(updated?.closedAt).toEqual(closedVisit.closedAt)
  })

  it('keeps a follow-up visit on follow-up when it is reassigned', async () => {
    const dueAt = new Date('2026-09-25T00:00:00Z')
    const visitRepository = createFakeVisitRepository([
      {
        ...unassigned,
        id: 'v3',
        status: 'closed',
        studentStatus: 'follow_up_needed',
        followUpDueAt: dueAt,
      },
    ])

    await reassignVisit('super_admin', 'v3', 'demoCounselorOne', { visitRepository })

    const updated = await visitRepository.findById('v3')
    expect(updated?.studentStatus).toBe('follow_up_needed')
    expect(updated?.followUpDueAt).toEqual(dueAt)
  })
})
