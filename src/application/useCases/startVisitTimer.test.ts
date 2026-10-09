import { describe, it, expect } from 'vitest'
import { startVisitTimer } from './startVisitTimer'
import { createFakeVisitRepository, createFixedClock } from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'

function assignedVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'visit-1',
    type: 'new',
    name: 'Demo Student One',
    phone: '56012345',
    desiredCountry: 'US',
    counselorId: 'demoCounselorOne',
    linkedVisitId: null,
    status: 'next',
    studentStatus: 'waiting',
    pickedUpAt: null,
    closedAt: null,
    followUpDueAt: null,
    createdBy: 'staff-1',
    createdAt: new Date('2026-08-12T09:00:00Z'),
    updatedAt: new Date('2026-08-12T09:00:00Z'),
    ...overrides,
  }
}

describe('startVisitTimer', () => {
  it('picks up the oldest assigned-and-not-started visit and stamps pickedUpAt', async () => {
    const visitRepository = createFakeVisitRepository([assignedVisit()])
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))
    const result = await startVisitTimer('demoCounselorOne', { visitRepository, clock })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.pickedUpAt).toEqual(new Date('2026-08-12T10:00:00Z'))
  })

  it('fails when no assigned visit is waiting', async () => {
    const visitRepository = createFakeVisitRepository()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))
    const result = await startVisitTimer('demoCounselorOne', { visitRepository, clock })
    expect(result.ok).toBe(false)
  })

  it('rejects starting a second visit while one is already in progress for the counselor', async () => {
    const visitRepository = createFakeVisitRepository([
      assignedVisit({ id: 'visit-1' }),
      assignedVisit({ id: 'visit-2' }),
    ])
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))

    const first = await startVisitTimer('demoCounselorOne', { visitRepository, clock })
    expect(first.ok).toBe(true)

    const second = await startVisitTimer('demoCounselorOne', { visitRepository, clock })
    expect(second.ok).toBe(false)

    const visitTwo = await visitRepository.findById('visit-2')
    expect(visitTwo?.pickedUpAt).toBeNull()
  })
})
