import { describe, it, expect } from 'vitest'
import { closeVisitAndAdvance, NOT_YOUR_VISIT_REASON } from './closeVisitAndAdvance'
import { createFakeVisitRepository, createFixedClock } from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'

function inProgressVisit(): Visit {
  return {
    id: 'visit-1',
    type: 'new',
    name: 'Demo Student One',
    phone: '56012345',
    desiredCountry: 'US',
    counselorId: 'demoCounselorOne',
    linkedVisitId: null,
    status: 'next',
    studentStatus: 'in_session',
    pickedUpAt: new Date('2026-08-12T10:00:00Z'),
    closedAt: null,
    followUpDueAt: null,
    createdBy: 'staff-1',
    createdAt: new Date('2026-08-12T09:00:00Z'),
    updatedAt: new Date('2026-08-12T09:00:00Z'),
  }
}

describe('closeVisitAndAdvance', () => {
  it('stamps closedAt and closes the visit when the student status is "closed"', async () => {
    const visitRepository = createFakeVisitRepository([inProgressVisit()])
    const clock = createFixedClock(new Date('2026-08-12T10:18:00Z'))
    const result = await closeVisitAndAdvance('visit-1', 'closed', 'demoCounselorOne', {
      visitRepository,
      clock,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.closedAt).toEqual(new Date('2026-08-12T10:18:00Z'))
      expect(result.visit.status).toBe('closed')
      expect(result.visit.studentStatus).toBe('closed')
    }
  })

  it('closes the visit when the student status is "follow_up_needed"', async () => {
    const visitRepository = createFakeVisitRepository([inProgressVisit()])
    const clock = createFixedClock(new Date('2026-08-12T10:18:00Z'))
    const result = await closeVisitAndAdvance('visit-1', 'follow_up_needed', 'demoCounselorOne', {
      visitRepository,
      clock,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.status).toBe('closed')
      expect(result.visit.studentStatus).toBe('follow_up_needed')
    }
  })

  // كان "بالانتظار" يختم closed_at ويخلي الحالة next — فالزيارة الوحدة تُحسب
  // "خُدمت اليوم"، وتبان مفتوحة بالقمع، وتظل "قيد التنفيذ" بمدة الإنجاز للأبد
  it('refuses "waiting" as a way to finish, so the three counters cannot disagree', async () => {
    const visitRepository = createFakeVisitRepository([inProgressVisit()])
    const clock = createFixedClock(new Date('2026-08-12T10:18:00Z'))

    const result = await closeVisitAndAdvance('visit-1', 'waiting', 'demoCounselorOne', {
      visitRepository,
      clock,
    })

    expect(result).toEqual({ ok: false, reason: 'studentStatusNotAllowedForVisit' })
    const untouched = await visitRepository.findById('visit-1')
    expect(untouched?.closedAt).toBeNull()
    expect(untouched?.status).toBe('next')
  })

  it.each(['follow_up_needed', 'closed'] as const)(
    'closes the visit when finished as %s, stamping closedAt with it',
    async (studentStatus) => {
      const visitRepository = createFakeVisitRepository([inProgressVisit()])
      const clock = createFixedClock(new Date('2026-08-12T10:18:00Z'))

      const result = await closeVisitAndAdvance('visit-1', studentStatus, 'demoCounselorOne', {
        visitRepository,
        clock,
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        // الثلاثة يتحركون مع بعض: ما فيه closed_at بلا status = closed
        expect(result.visit.status).toBe('closed')
        expect(result.visit.studentStatus).toBe(studentStatus)
        expect(result.visit.closedAt).toEqual(new Date('2026-08-12T10:18:00Z'))
      }
    }
  )

  it('fails when the visit was never started', async () => {
    const notStarted: Visit = { ...inProgressVisit(), pickedUpAt: null }
    const visitRepository = createFakeVisitRepository([notStarted])
    const clock = createFixedClock(new Date())
    const result = await closeVisitAndAdvance('visit-1', 'closed', 'demoCounselorOne', {
      visitRepository,
      clock,
    })
    expect(result.ok).toBe(false)
  })

  it('fails when a different counselor tries to close the visit, and leaves it untouched', async () => {
    const visitRepository = createFakeVisitRepository([inProgressVisit()])
    const clock = createFixedClock(new Date('2026-08-12T10:18:00Z'))
    const result = await closeVisitAndAdvance('visit-1', 'closed', 'omar', {
      visitRepository,
      clock,
    })
    expect(result.ok).toBe(false)

    const untouched = await visitRepository.findById('visit-1')
    expect(untouched?.closedAt).toBeNull()
    expect(untouched?.status).toBe('next')
  })

  it('stores the follow-up due date when closing as "follow_up_needed"', async () => {
    const visitRepository = createFakeVisitRepository([inProgressVisit()])
    const clock = createFixedClock(new Date('2026-08-12T10:18:00Z'))
    const dueAt = new Date('2026-08-15T00:00:00Z')
    const result = await closeVisitAndAdvance(
      'visit-1',
      'follow_up_needed',
      'demoCounselorOne',
      { visitRepository, clock },
      null,
      dueAt
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.followUpDueAt).toEqual(dueAt)
  })

  it('checks ownership before the unstarted-visit check', async () => {
    const notStarted: Visit = { ...inProgressVisit(), pickedUpAt: null }
    const visitRepository = createFakeVisitRepository([notStarted])
    const clock = createFixedClock(new Date())
    const result = await closeVisitAndAdvance('visit-1', 'closed', 'omar', {
      visitRepository,
      clock,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe(NOT_YOUR_VISIT_REASON)
  })
})
