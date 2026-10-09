import { describe, it, expect } from 'vitest'
import type { Visit } from '../../domain/entities/visit'
import type { User } from '../../domain/entities/user'
import {
  createFakeVisitRepository,
  createFakeUserRepository,
  createFixedClock,
} from '../testing/fakes'
import { listVisitsForScope } from './listVisitsForScope'

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    type: 'visa',
    name: 'Sample Client',
    phone: '50000001',
    desiredCountry: null,
    counselorId: null,
    linkedVisitId: null,
    status: 'next',
    studentStatus: 'waiting',
    pickedUpAt: null,
    closedAt: null,
    note: null,
    followUpDueAt: null,
    createdBy: null,
    createdAt: new Date('2026-09-13T09:20:00Z'),
    updatedAt: new Date('2026-09-13T09:20:00Z'),
    ...overrides,
  }
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'c1',
    name: 'Sample Counselor',
    nameAr: null,
    role: 'counselor',
    email: 'c@example.com',
    passwordHash: 'x',
    active: true,
    createdAt: new Date(),
    lastSeenAt: null,
    onlineSecondsToday: 0,
    onlineDay: null,
    shift: 'night',
    floor: null,
    note: null,
    ...overrides,
  } as User
}

async function run(visits: Visit[], users: User[]) {
  const result = await listVisitsForScope('super_admin', [], 'visa', {
    visitRepository: createFakeVisitRepository(visits),
    userRepository: createFakeUserRepository(users),
    clock: createFixedClock(new Date('2026-09-21T09:00:00Z')),
  })
  if (!result.ok) throw new Error(result.reason)
  return result.visits
}

describe('listVisitsForScope', () => {
  // المعرّف الخام كان يطلع مكان الاسم لأن الواجهة كانت تترجمه من قائمة
  // "النشطين"، واللي خارج دوامه مو فيها
  it('resolves the counselor name, even for a counselor off shift right now', async () => {
    const [row] = await run(
      [visit({ counselorId: 'c1' })],
      [user({ id: 'c1', name: 'Demo Counselor Eight', shift: 'night' })]
    )
    expect(row.counselorName).toBe('Demo Counselor Eight')
    expect(row.counselorId).toBe('c1')
  })

  it('resolves the name of a deactivated counselor too, so old rows stay readable', async () => {
    const [row] = await run(
      [visit({ counselorId: 'c1' })],
      [user({ id: 'c1', name: 'Left The Company', active: false })]
    )
    expect(row.counselorName).toBe('Left The Company')
  })

  it('carries the Arabic name through when there is one', async () => {
    const [row] = await run(
      [visit({ counselorId: 'c1' })],
      [user({ id: 'c1', name: 'Demo Counselor Eight', nameAr: 'مستشار تجريبي ثامن' })]
    )
    expect(row.counselorNameAr).toBe('مستشار تجريبي ثامن')
  })

  it('leaves the name null on an unassigned visit', async () => {
    const [row] = await run([visit()], [user()])
    expect(row.counselorName).toBeNull()
    expect(row.counselorNameAr).toBeNull()
  })

  it('leaves the name null when the counselor no longer exists', async () => {
    const [row] = await run([visit({ counselorId: 'deleted-id' })], [user()])
    expect(row.counselorName).toBeNull()
  })

  it('refuses a counselor without the visa scope', async () => {
    const result = await listVisitsForScope('counselor', ['exam_services'], 'visa', {
      visitRepository: createFakeVisitRepository([visit()]),
      clock: createFixedClock(new Date('2026-09-21T09:00:00Z')),
      userRepository: createFakeUserRepository([user()]),
    })
    expect(result).toEqual({ ok: false, reason: 'notAuthorizedScope' })
  })
})
