import { describe, it, expect } from 'vitest'
import { getVisitQueuePosition } from './getVisitQueuePosition'
import {
  createFakeVisitRepository,
  createFakeUserRepository,
  createFixedClock,
} from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'
import type { User } from '../../domain/entities/user'
import { workingDaysSinceLastSeen } from '../../domain/time/workingDaysSinceLastSeen'
import { ABSENT_AFTER_WORKING_DAYS } from '../../domain/routing/counselorAbsence'

const counselor: User = {
  id: 'demoCounselorOne',
  name: 'Demo Counselor One',
  role: 'counselor',
  email: 'demoCounselorOne@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
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

// ١٠ صباحًا بتوقيت الكويت — المسائي يكون خارج شفته
const MORNING = new Date('2026-09-22T07:00:00Z')

describe('getVisitQueuePosition', () => {
  it('reports 0 people ahead when it is the only visit in the queue', async () => {
    const visitRepository = createFakeVisitRepository([makeVisit()])
    const userRepository = createFakeUserRepository([counselor])
    const result = await getVisitQueuePosition('v1', {
      visitRepository,
      userRepository,
      clock: createFixedClock(MORNING),
    })
    expect(result).toEqual({
      ok: true,
      position: 0,
      counselorName: 'Demo Counselor One',
      calledIn: false,
      counselorShift: null,
    })
  })

  it('reports the count of visits ahead of it, not its 1-based rank', async () => {
    const first = makeVisit({ id: 'v1', createdAt: new Date('2026-08-12T09:00:00Z') })
    const second = makeVisit({ id: 'v2', createdAt: new Date('2026-08-12T09:05:00Z') })
    const visitRepository = createFakeVisitRepository([first, second])
    const userRepository = createFakeUserRepository([counselor])
    const result = await getVisitQueuePosition('v2', {
      visitRepository,
      userRepository,
      clock: createFixedClock(MORNING),
    })
    expect(result).toEqual({
      ok: true,
      position: 1,
      counselorName: 'Demo Counselor One',
      calledIn: false,
      counselorShift: null,
    })
  })

  it('reports calledIn true once the visit has been picked up', async () => {
    const visit = makeVisit({ pickedUpAt: new Date('2026-08-12T09:10:00Z') })
    const visitRepository = createFakeVisitRepository([visit])
    const userRepository = createFakeUserRepository([counselor])
    const result = await getVisitQueuePosition('v1', {
      visitRepository,
      userRepository,
      clock: createFixedClock(MORNING),
    })
    expect(result).toEqual({
      ok: true,
      position: 0,
      counselorName: 'Demo Counselor One',
      calledIn: true,
      counselorShift: null,
    })
  })

  it('rejects an unknown visit id', async () => {
    const visitRepository = createFakeVisitRepository([])
    const userRepository = createFakeUserRepository([counselor])
    const result = await getVisitQueuePosition('missing', {
      visitRepository,
      userRepository,
      clock: createFixedClock(MORNING),
    })
    expect(result.ok).toBe(false)
  })
})

// شاشة الزائر تقول متى يبدأ دوام مستشاره — ولا كلمة عن غيابه
describe('what the waiting client is told about the shift', () => {
  // آخر دخول أمس — حاضر، فوعد "متاح من الثالثة" وعدٌ نقدر نفي فيه
  const nightCounselor = {
    ...counselor,
    shift: 'night' as const,
    lastSeenAt: new Date('2026-09-21T09:00:00Z'),
  }
  const EVENING = new Date('2026-09-22T14:00:00Z') // ٥ مساءً بالكويت

  async function ask(user: typeof counselor, now: Date) {
    return getVisitQueuePosition('v1', {
      visitRepository: createFakeVisitRepository([makeVisit()]),
      userRepository: createFakeUserRepository([user]),
      clock: createFixedClock(now),
    })
  }

  it('tells a morning client when the evening shift starts', async () => {
    const result = await ask(nightCounselor, MORNING)
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.counselorShift).toEqual({ shift: 'night', availableFromMinutes: 900 })
  })

  // بدأ دوامه: ما فيه شي يُقال، هو متاح الحين
  it('says nothing once that shift has started', async () => {
    const result = await ask(nightCounselor, EVENING)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.counselorShift).toBeNull()
  })

  it('says nothing for a counselor with no shift set', async () => {
    const result = await ask(counselor, MORNING)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.counselorShift).toBeNull()
  })

  // آخر ظهور ٣ سبتمبر = ١٣ يوم دوام قبل ٢٢ سبتمبر. الوعد ما عاد صادقاً:
  // اللي ما حضر من أسبوعين الأرجح ما راح يفتح شباكه الثالثة اليوم
  it('promises nothing for a night counselor absent 13 working days', async () => {
    const longGone = { ...nightCounselor, lastSeenAt: new Date('2026-09-03T09:00:00Z') }
    expect(workingDaysSinceLastSeen(longGone.lastSeenAt, MORNING)).toBe(13)

    const result = await ask(longGone, MORNING)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.counselorShift).toBeNull()
  })

  // وهو ساكت عن السبب: الشاشة ما تختلف عن أي شاشة انتظار عادية
  it('never leaks absence to the client, however long they have been away', async () => {
    const longGone = { ...nightCounselor, lastSeenAt: new Date('2026-08-01T09:00:00Z') }
    const result = await ask(longGone, MORNING)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(JSON.stringify(result)).not.toMatch(/working day|lastSeen|absent|not in/i)
      expect(result.counselorShift).toBeNull()
    }
  })

  // الحد بالضبط: أربعة تقول، خمسة تسكت — نفس الرقم اللي يوزّع عليه النظام
  it('still promises at 4 working days, and stops at 5', async () => {
    const fourDays = { ...nightCounselor, lastSeenAt: new Date('2026-09-16T09:00:00Z') }
    const fiveDays = { ...nightCounselor, lastSeenAt: new Date('2026-09-15T09:00:00Z') }
    expect(workingDaysSinceLastSeen(fourDays.lastSeenAt, MORNING)).toBe(4)
    expect(workingDaysSinceLastSeen(fiveDays.lastSeenAt, MORNING)).toBe(ABSENT_AFTER_WORKING_DAYS)

    const stillPromised = await ask(fourDays, MORNING)
    expect(stillPromised.ok).toBe(true)
    if (stillPromised.ok)
      expect(stillPromised.counselorShift).toEqual({ shift: 'night', availableFromMinutes: 900 })

    const silent = await ask(fiveDays, MORNING)
    expect(silent.ok).toBe(true)
    if (silent.ok) expect(silent.counselorShift).toBeNull()
  })

  // حساب ما فتح التطبيق ولا مرة غايب بتعريف الـ domain — فما نعده الزائر بشي
  it('promises nothing for a counselor who has never signed in', async () => {
    const neverSeen = { ...nightCounselor, lastSeenAt: null }
    const result = await ask(neverSeen, MORNING)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.counselorShift).toBeNull()
  })
})
