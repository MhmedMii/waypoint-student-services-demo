import { describe, it, expect } from 'vitest'
import { listActiveCounselors } from './listActiveCounselors'
import { createFakeUserRepository, createFixedClock } from '../testing/fakes'
import type { User } from '../../domain/entities/user'

const activeCounselor: User = {
  id: 'u1',
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
const inactiveCounselor: User = {
  id: 'u2',
  name: 'Demo Counselor Eight',
  role: 'counselor',
  email: 'omar@example.com',
  passwordHash: 'x',
  active: false,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}
const admin: User = {
  id: 'u3',
  name: 'Front Admin',
  role: 'admin',
  email: 'admin@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}
const nightCounselor: User = {
  id: 'u4',
  name: 'Fictional Student E',
  role: 'counselor',
  email: 'layla@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: 'night',
  floor: 'M1',
}

// 2026-01-05T07:00:00Z = 10:00 بتوقيت الكويت (UTC+3)، داخل فترة الاستبعاد الصباحية للدوام المسائي
const kuwaitMorning = new Date('2026-01-05T07:00:00Z')
// 2026-01-05T13:00:00Z = 16:00 بتوقيت الكويت، داخل فترة ظهور الدوام المسائي
const kuwaitAfternoon = new Date('2026-01-05T13:00:00Z')

describe('listActiveCounselors', () => {
  it('returns only id and name for active counselors', async () => {
    const userRepository = createFakeUserRepository([activeCounselor, inactiveCounselor, admin])
    const result = await listActiveCounselors({
      userRepository,
      clock: createFixedClock(kuwaitMorning),
    })

    expect(result).toEqual([{ id: 'u1', name: 'Demo Counselor One', nameAr: null }])
  })

  it('hides night-shift counselors before their visibility window', async () => {
    const userRepository = createFakeUserRepository([activeCounselor, nightCounselor])
    const result = await listActiveCounselors({
      userRepository,
      clock: createFixedClock(kuwaitMorning),
    })

    expect(result).toEqual([{ id: 'u1', name: 'Demo Counselor One', nameAr: null }])
  })

  it('shows night-shift counselors during their visibility window', async () => {
    const userRepository = createFakeUserRepository([activeCounselor, nightCounselor])
    const result = await listActiveCounselors({
      userRepository,
      clock: createFixedClock(kuwaitAfternoon),
    })

    expect(result).toEqual([
      { id: 'u1', name: 'Demo Counselor One', nameAr: null },
      { id: 'u4', name: 'Fictional Student E', nameAr: null },
    ])
  })
})
