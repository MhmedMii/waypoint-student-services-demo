import { describe, it, expect } from 'vitest'
import { breakOut } from './breakOut'
import {
  createFakeVisitRepository,
  createFakeBreakRepository,
  createFixedClock,
} from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'

describe('breakOut', () => {
  it('starts a break when the counselor is idle', async () => {
    const visitRepository = createFakeVisitRepository()
    const breakRepository = createFakeBreakRepository()
    const clock = createFixedClock(new Date('2026-08-12T11:00:00Z'))
    const result = await breakOut('demoCounselorOne', { visitRepository, breakRepository, clock })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.break.startedAt).toEqual(new Date('2026-08-12T11:00:00Z'))
  })

  it('rejects starting a break while a client is in progress', async () => {
    const inProgress: Visit = {
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
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const visitRepository = createFakeVisitRepository([inProgress])
    const breakRepository = createFakeBreakRepository()
    const clock = createFixedClock(new Date())
    const result = await breakOut('demoCounselorOne', { visitRepository, breakRepository, clock })
    expect(result.ok).toBe(false)
  })
})
// ضغطتان على شاشة لمس سلوك عادي. كل ضغطة كانت تفتح صفًا، وendBreak يقفلهم
// كلهم بنفس الوقت، فنصف ساعة تُحسب ساعة — ووقت الاستراحة مقياس أداء
describe('breakOut — tapping Break twice', () => {
  it('returns the break already open instead of starting a second', async () => {
    const visitRepository = createFakeVisitRepository()
    const breakRepository = createFakeBreakRepository()
    const clock = createFixedClock(new Date('2026-08-12T11:00:00Z'))

    const first = await breakOut('demoCounselorOne', { visitRepository, breakRepository, clock })
    const second = await breakOut('demoCounselorOne', { visitRepository, breakRepository, clock })

    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) expect(second.break.id).toBe(first.break.id)
  })

  it('keeps the original start time, so the break is not silently restarted', async () => {
    const visitRepository = createFakeVisitRepository()
    const breakRepository = createFakeBreakRepository()

    const first = await breakOut('demoCounselorOne', {
      visitRepository,
      breakRepository,
      clock: createFixedClock(new Date('2026-08-12T11:00:00Z')),
    })
    // ضغطة ثانية بعد عشر دقائق ما تلغي العشر دقائق اللي مضت
    const second = await breakOut('demoCounselorOne', {
      visitRepository,
      breakRepository,
      clock: createFixedClock(new Date('2026-08-12T11:10:00Z')),
    })

    expect(second.ok).toBe(true)
    if (first.ok && second.ok) expect(second.break.startedAt).toEqual(first.break.startedAt)
  })

  it('counts one break, not two, after the double tap ends', async () => {
    const visitRepository = createFakeVisitRepository()
    const breakRepository = createFakeBreakRepository()
    const start = createFixedClock(new Date('2026-08-12T11:00:00Z'))

    await breakOut('demoCounselorOne', { visitRepository, breakRepository, clock: start })
    await breakOut('demoCounselorOne', { visitRepository, breakRepository, clock: start })
    await breakRepository.endBreak('demoCounselorOne', new Date('2026-08-12T11:30:00Z'))

    const total = await breakRepository.sumFinishedBreakMsToday(
      'demoCounselorOne',
      new Date('2026-08-12T12:00:00Z')
    )
    expect(total).toBe(30 * 60 * 1000)
  })

  it('starts a fresh break once the previous one has ended', async () => {
    const visitRepository = createFakeVisitRepository()
    const breakRepository = createFakeBreakRepository()

    const first = await breakOut('demoCounselorOne', {
      visitRepository,
      breakRepository,
      clock: createFixedClock(new Date('2026-08-12T11:00:00Z')),
    })
    await breakRepository.endBreak('demoCounselorOne', new Date('2026-08-12T11:30:00Z'))
    const second = await breakOut('demoCounselorOne', {
      visitRepository,
      breakRepository,
      clock: createFixedClock(new Date('2026-08-12T14:00:00Z')),
    })

    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) expect(second.break.id).not.toBe(first.break.id)
  })
})
