import { describe, it, expect } from 'vitest'
import { getCounselorSupervision } from './getCounselorSupervision'
import {
  createFakeUserRepository,
  createFakeVisitRepository,
  createFakeBreakRepository,
  createFixedClock,
} from '../testing/fakes'
import type { User } from '../../domain/entities/user'

const NOW = new Date('2026-09-09T12:00:00.000Z')
const TODAY = '2026-09-09'

function counselor(overrides: Partial<User> = {}): User {
  return {
    id: 'c1',
    name: 'Demo Counselor Two',
    nameAr: null,
    role: 'counselor',
    email: 'ali@example.com',
    passwordHash: 'x',
    active: true,
    lastSeenAt: null,
    onlineSecondsToday: 0,
    onlineDay: null,
    shift: null,
    floor: null,
    ...overrides,
  }
}

describe('getCounselorSupervision', () => {
  it('shows idle for an online counselor with no break or in-progress visit', async () => {
    const userRepository = createFakeUserRepository([
      counselor({ lastSeenAt: NOW, onlineSecondsToday: 100, onlineDay: TODAY }),
    ])
    const result = await getCounselorSupervision({
      userRepository,
      visitRepository: createFakeVisitRepository(),
      breakRepository: createFakeBreakRepository(),
      clock: createFixedClock(NOW),
    })
    expect(result[0].status).toBe('idle')
  })

  it('shows on_break for an online counselor with an open break', async () => {
    const userRepository = createFakeUserRepository([
      counselor({ lastSeenAt: NOW, onlineSecondsToday: 100, onlineDay: TODAY }),
    ])
    const breakRepository = createFakeBreakRepository()
    await breakRepository.startBreak('c1', new Date('2026-09-09T11:50:00.000Z'))
    const result = await getCounselorSupervision({
      userRepository,
      visitRepository: createFakeVisitRepository(),
      breakRepository,
      clock: createFixedClock(NOW),
    })
    expect(result[0].status).toBe('on_break')
  })

  // كان لو المستشار راح (سكّر التبويب) واستراحته أو زيارته ظلت مفتوحة، يعلّق
  // على "في استراحة"/"مع طالب" للأبد بدل ما يوضح إنه فعلياً أوفلاين الحين
  it('shows away, not on_break, when an offline counselor left a break open', async () => {
    const userRepository = createFakeUserRepository([
      counselor({
        lastSeenAt: new Date('2026-09-09T11:00:00.000Z'),
        onlineSecondsToday: 3600,
        onlineDay: TODAY,
      }),
    ])
    const breakRepository = createFakeBreakRepository()
    await breakRepository.startBreak('c1', new Date('2026-09-09T10:50:00.000Z'))
    const result = await getCounselorSupervision({
      userRepository,
      visitRepository: createFakeVisitRepository(),
      breakRepository,
      clock: createFixedClock(NOW),
    })
    expect(result[0].status).toBe('away')
  })

  it('shows away for a counselor who was online earlier today but is not online now', async () => {
    const userRepository = createFakeUserRepository([
      counselor({
        lastSeenAt: new Date('2026-09-09T10:00:00.000Z'),
        onlineSecondsToday: 3600,
        onlineDay: TODAY,
      }),
    ])
    const result = await getCounselorSupervision({
      userRepository,
      visitRepository: createFakeVisitRepository(),
      breakRepository: createFakeBreakRepository(),
      clock: createFixedClock(NOW),
    })
    expect(result[0].status).toBe('away')
    expect(result[0].lastSeenAt).toBe('2026-09-09T10:00:00.000Z')
  })

  it('shows offline for a counselor who was never online today', async () => {
    const userRepository = createFakeUserRepository([
      counselor({ lastSeenAt: null, onlineSecondsToday: 0 }),
    ])
    const result = await getCounselorSupervision({
      userRepository,
      visitRepository: createFakeVisitRepository(),
      breakRepository: createFakeBreakRepository(),
      clock: createFixedClock(NOW),
    })
    expect(result[0].status).toBe('offline')
  })

  // الساعة 00:30 UTC = 3:30ص بالكويت، يعني يوم الكويت لسا 10 سبتمبر بادئ من
  // 9 سبتمبر 9م UTC — زيارة أُنشئت 9 سبتمبر 10م UTC تعتبر "اليوم" بتوقيت
  // الكويت، بس تقع "بالأمس" لو حسبنا بداية اليوم بتوقيت UTC الافتراضي
  it("counts a visit created near midnight as today's, using Kuwait's day boundary", async () => {
    const nowJustAfterKuwaitMidnight = new Date('2026-09-10T00:30:00.000Z')
    const createdBeforeUtcMidnightButAfterKuwaitMidnight = new Date('2026-09-09T22:00:00.000Z')
    const userRepository = createFakeUserRepository([
      counselor({
        lastSeenAt: nowJustAfterKuwaitMidnight,
        onlineSecondsToday: 100,
        onlineDay: '2026-09-10',
      }),
    ])
    const visitRepository = createFakeVisitRepository([
      {
        id: 'v1',
        type: 'new',
        name: 'Client A',
        phone: '50000001',
        desiredCountry: null,
        counselorId: 'c1',
        linkedVisitId: null,
        status: 'closed',
        studentStatus: 'closed',
        pickedUpAt: createdBeforeUtcMidnightButAfterKuwaitMidnight,
        closedAt: new Date('2026-09-09T22:30:00.000Z'),
        followUpDueAt: null,
        createdBy: null,
        createdAt: createdBeforeUtcMidnightButAfterKuwaitMidnight,
        updatedAt: new Date('2026-09-09T22:30:00.000Z'),
      },
    ])
    const result = await getCounselorSupervision({
      userRepository,
      visitRepository,
      breakRepository: createFakeBreakRepository(),
      clock: createFixedClock(nowJustAfterKuwaitMidnight),
    })
    expect(result[0].closedToday).toBe(1)
  })
})
