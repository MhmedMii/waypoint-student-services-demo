import { describe, it, expect } from 'vitest'
import { getCounselorQueue } from './getCounselorQueue'
import {
  createFakeVisitRepository,
  createFakeBreakRepository,
  createFixedClock,
} from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'

function visit(overrides: Partial<Visit>): Visit {
  return {
    id: 'v',
    type: 'new',
    name: 'Client',
    phone: '56012345',
    desiredCountry: 'US',
    counselorId: 'demoCounselorOne',
    linkedVisitId: null,
    status: 'next',
    studentStatus: 'waiting',
    pickedUpAt: null,
    closedAt: null,
    followUpDueAt: null,
    createdBy: 'staff',
    createdAt: new Date('2026-08-12T09:00:00Z'),
    updatedAt: new Date('2026-08-12T09:00:00Z'),
    ...overrides,
  }
}

describe('getCounselorQueue', () => {
  it('reports the in-progress visit and its running elapsed time', async () => {
    const inProgress = visit({ id: 'v1', pickedUpAt: new Date('2026-08-12T10:00:00Z') })
    const visitRepository = createFakeVisitRepository([inProgress])
    const breakRepository = createFakeBreakRepository()
    const clock = createFixedClock(new Date('2026-08-12T10:05:00Z'))

    const view = await getCounselorQueue('demoCounselorOne', {
      visitRepository,
      breakRepository,
      clock,
    })
    expect(view.currentVisit?.id).toBe('v1')
    expect(view.elapsed).toEqual({ status: 'running', elapsedMs: 300000 })
  })

  it('reports waiting count and next name when idle', async () => {
    const waiting = visit({ id: 'v2', name: 'Noura Reed' })
    const visitRepository = createFakeVisitRepository([waiting])
    const breakRepository = createFakeBreakRepository()
    const clock = createFixedClock(new Date())

    const view = await getCounselorQueue('demoCounselorOne', {
      visitRepository,
      breakRepository,
      clock,
    })
    expect(view.currentVisit).toBeNull()
    expect(view.waitingCount).toBe(1)
    expect(view.nextWaitingName).toBe('Noura Reed')
  })

  it('counts visits closed today and averages their handling time', async () => {
    const closedToday1 = visit({
      id: 'v3',
      pickedUpAt: new Date('2026-08-12T09:00:00Z'),
      closedAt: new Date('2026-08-12T09:10:00Z'), // 10 min
      status: 'closed',
    })
    const closedToday2 = visit({
      id: 'v4',
      pickedUpAt: new Date('2026-08-12T11:00:00Z'),
      closedAt: new Date('2026-08-12T11:06:00Z'), // 6 min
      status: 'closed',
    })
    const closedYesterday = visit({
      id: 'v5',
      pickedUpAt: new Date('2026-08-11T09:00:00Z'),
      closedAt: new Date('2026-08-11T09:20:00Z'),
      status: 'closed',
    })
    const visitRepository = createFakeVisitRepository([closedToday1, closedToday2, closedYesterday])
    const breakRepository = createFakeBreakRepository()
    const clock = createFixedClock(new Date('2026-08-12T15:00:00Z'))

    const view = await getCounselorQueue('demoCounselorOne', {
      visitRepository,
      breakRepository,
      clock,
    })
    expect(view.servedToday).toBe(2)
    expect(view.avgHandlingMs).toBe(8 * 60 * 1000) // average of 10 and 6 minutes
  })

  it('reports a null average when nothing has been closed today', async () => {
    const visitRepository = createFakeVisitRepository([])
    const breakRepository = createFakeBreakRepository()
    const clock = createFixedClock(new Date('2026-08-12T15:00:00Z'))

    const view = await getCounselorQueue('demoCounselorOne', {
      visitRepository,
      breakRepository,
      clock,
    })
    expect(view.servedToday).toBe(0)
    expect(view.avgHandlingMs).toBeNull()
  })

  // حدود اليوم بتوقيت الكويت (UTC+3): من 21:00Z الليلة الماضية لين 21:00Z الليلة.
  // الفيك كان يحسبها بمنتصف ليل الجهاز، فهالحالات ما كانت تنكشف أبدًا

  // الفيك كان يرجّع الصفوف بترتيب الإدخال، فهالتست ما كان يقدر يفشل أصلاً
  it('names the client who has waited longest, not the one seeded first', async () => {
    const newer = visit({
      id: 'v-newer',
      name: 'Arrived Second',
      createdAt: new Date('2026-08-12T10:00:00Z'),
    })
    const older = visit({
      id: 'v-older',
      name: 'Arrived First',
      createdAt: new Date('2026-08-12T08:00:00Z'),
    })

    const view = await getCounselorQueue('demoCounselorOne', {
      // مزروعين بالعكس عمدًا
      visitRepository: createFakeVisitRepository([newer, older]),
      breakRepository: createFakeBreakRepository(),
      clock: createFixedClock(new Date('2026-08-12T11:00:00Z')),
    })

    expect(view.waitingCount).toBe(2)
    expect(view.nextWaitingName).toBe('Arrived First')
  })

  describe('the Kuwait day boundary, not the machine’s', () => {
    // 22:00Z = 1 صباحًا بالكويت من اليوم التالي
    const justAfterKuwaitMidnight = new Date('2026-08-12T22:00:00Z')

    it('counts a visit closed just after Kuwait midnight as today', async () => {
      const closed = visit({
        id: 'v1',
        pickedUpAt: new Date('2026-08-12T21:30:00Z'),
        closedAt: new Date('2026-08-12T21:50:00Z'),
        status: 'closed',
        studentStatus: 'closed',
      })
      const view = await getCounselorQueue('demoCounselorOne', {
        visitRepository: createFakeVisitRepository([closed]),
        breakRepository: createFakeBreakRepository(),
        clock: createFixedClock(justAfterKuwaitMidnight),
      })
      expect(view.servedToday).toBe(1)
      expect(view.avgHandlingMs).toBe(20 * 60000)
    })

    it('does not count one closed just before Kuwait midnight', async () => {
      const closed = visit({
        id: 'v1',
        pickedUpAt: new Date('2026-08-12T20:00:00Z'),
        closedAt: new Date('2026-08-12T20:50:00Z'),
        status: 'closed',
        studentStatus: 'closed',
      })
      const view = await getCounselorQueue('demoCounselorOne', {
        visitRepository: createFakeVisitRepository([closed]),
        breakRepository: createFakeBreakRepository(),
        clock: createFixedClock(justAfterKuwaitMidnight),
      })
      expect(view.servedToday).toBe(0)
      expect(view.avgHandlingMs).toBeNull()
    })

    it('resets break time at Kuwait midnight too, so both halves of the row agree', async () => {
      const breakRepository = createFakeBreakRepository()
      await breakRepository.startBreak('demoCounselorOne', new Date('2026-08-12T20:00:00Z'))
      await breakRepository.endBreak('demoCounselorOne', new Date('2026-08-12T20:30:00Z'))

      const view = await getCounselorQueue('demoCounselorOne', {
        visitRepository: createFakeVisitRepository([]),
        breakRepository,
        clock: createFixedClock(justAfterKuwaitMidnight),
      })
      expect(view.breakTotalMsToday).toBe(0)
    })
  })
})
