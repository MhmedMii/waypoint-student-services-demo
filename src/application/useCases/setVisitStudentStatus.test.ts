import { describe, it, expect } from 'vitest'
import type { Visit } from '../../domain/entities/visit'
import { createFakeVisitRepository } from '../testing/fakes'
import { setVisitStudentStatus } from './setVisitStudentStatus'
import { NOT_YOUR_VISIT_REASON } from './closeVisitAndAdvance'

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    type: 'visa',
    name: 'Test Client',
    phone: '98721391',
    desiredCountry: null,
    counselorId: 'c1',
    linkedVisitId: null,
    status: 'closed',
    studentStatus: 'closed',
    pickedUpAt: new Date('2026-09-01T09:00:00Z'),
    closedAt: new Date('2026-09-01T09:10:00Z'),
    note: null,
    followUpDueAt: null,
    createdBy: null,
    createdAt: new Date('2026-09-01T08:50:00Z'),
    updatedAt: new Date('2026-09-01T09:10:00Z'),
    ...overrides,
  }
}

const DUE = new Date('2026-09-25T00:00:00Z')

async function run(
  seed: Visit,
  studentStatus: Parameters<typeof setVisitStudentStatus>[1],
  followUpDueAt?: Date | null,
  counselorId = 'c1'
) {
  const repo = createFakeVisitRepository([seed])
  const result = await setVisitStudentStatus(
    seed.id,
    studentStatus,
    counselorId,
    {
      visitRepository: repo,
    },
    followUpDueAt
  )
  return { result, saved: (await repo.findById(seed.id))! }
}

describe('setVisitStudentStatus', () => {
  it('moves a closed visit to Follow-up needed with its due date', async () => {
    const { result, saved } = await run(visit(), 'follow_up_needed', DUE)
    expect(result).toEqual({ ok: true })
    expect(saved.status).toBe('closed')
    expect(saved.studentStatus).toBe('follow_up_needed')
    expect(saved.followUpDueAt).toEqual(DUE)
  })

  it('moves a follow-up visit to Closed and clears the old due date', async () => {
    const { result, saved } = await run(
      visit({ studentStatus: 'follow_up_needed', followUpDueAt: DUE }),
      'closed'
    )
    expect(result).toEqual({ ok: true })
    expect(saved.studentStatus).toBe('closed')
    expect(saved.followUpDueAt).toBeNull()
  })

  it('ignores a due date sent with Closed, so it cannot linger', async () => {
    const { saved } = await run(visit(), 'closed', DUE)
    expect(saved.followUpDueAt).toBeNull()
  })

  it('requires a due date for Follow-up needed', async () => {
    const seed = visit()
    const { result, saved } = await run(seed, 'follow_up_needed')
    expect(result).toEqual({ ok: false, reason: 'followUpDueDateRequired' })
    expect(saved.studentStatus).toBe('closed')
    expect((await run(visit(), 'follow_up_needed', null)).result).toEqual({
      ok: false,
      reason: 'followUpDueDateRequired',
    })
  })

  it.each(['in_session', 'waiting'] as const)(
    'refuses %s on a closed visit and leaves it untouched',
    async (studentStatus) => {
      const { result, saved } = await run(visit(), studentStatus)
      expect(result).toEqual({ ok: false, reason: 'studentStatusNotAllowedForVisit' })
      expect(saved.status).toBe('closed')
      expect(saved.studentStatus).toBe('closed')
    }
  )

  it.each(['waiting', 'in_session', 'follow_up_needed', 'closed'] as const)(
    'refuses a manual %s edit on an open visit and leaves it untouched',
    async (studentStatus) => {
      const open = visit({
        status: 'next',
        studentStatus: 'waiting',
        closedAt: null,
      })
      const { result, saved } = await run(open, studentStatus, DUE)
      expect(result).toEqual({ ok: false, reason: 'studentStatusNotAllowedForVisit' })
      expect(saved.status).toBe('next')
      expect(saved.studentStatus).toBe('waiting')
      expect(saved.followUpDueAt).toBeNull()
    }
  )

  it('refuses a counselor who does not own the visit', async () => {
    const { result, saved } = await run(visit(), 'follow_up_needed', DUE, 'someone-else')
    expect(result).toEqual({ ok: false, reason: NOT_YOUR_VISIT_REASON })
    expect(saved.studentStatus).toBe('closed')
  })

  it('reports a missing visit', async () => {
    const repo = createFakeVisitRepository([])
    expect(await setVisitStudentStatus('nope', 'closed', 'c1', { visitRepository: repo })).toEqual({
      ok: false,
      reason: 'visitNotFound',
    })
  })
})
