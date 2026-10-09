import { describe, it, expect } from 'vitest'
import { listOnlinePresence } from './listOnlinePresence'
import { createFakeUserRepository, createFixedClock } from '../testing/fakes'
import type { User } from '../../domain/entities/user'

const now = new Date('2026-08-13T10:00:00Z')
const oneMinuteAgo = new Date('2026-08-13T09:59:00Z')
const oneHourAgo = new Date('2026-08-13T09:00:00Z')

const superAdmin: User = {
  id: 'sa1',
  name: 'Owner',
  role: 'super_admin',
  email: 'owner@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: oneMinuteAgo,
  onlineSecondsToday: 3600,
  onlineDay: '2026-08-13',
  shift: null,
  floor: null,
}
const admin: User = {
  id: 'a1',
  name: 'Front Admin',
  role: 'admin',
  email: 'admin@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: oneMinuteAgo,
  onlineSecondsToday: 1800,
  onlineDay: '2026-08-13',
  shift: null,
  floor: null,
}
const onlineCounselor: User = {
  id: 'c1',
  name: 'Demo Counselor Two',
  role: 'counselor',
  email: 'ali@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: oneMinuteAgo,
  onlineSecondsToday: 900,
  onlineDay: '2026-08-13',
  shift: null,
  floor: null,
}
const offlineCounselor: User = {
  id: 'c2',
  name: 'Demo Counselor Six',
  role: 'counselor',
  email: 'ali.m@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: oneHourAgo,
  onlineSecondsToday: 600,
  onlineDay: '2026-08-13',
  shift: null,
  floor: null,
}
const staleCounselor: User = {
  id: 'c4',
  name: 'Fictional Student S',
  role: 'counselor',
  email: 'sara@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: oneHourAgo,
  onlineSecondsToday: 5000,
  onlineDay: '2026-08-12',
  shift: null,
  floor: null,
}
const deactivatedCounselor: User = {
  id: 'c3',
  name: 'Old One',
  role: 'counselor',
  email: 'old@example.com',
  passwordHash: 'x',
  active: false,
  lastSeenAt: oneMinuteAgo,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

const seed = [
  superAdmin,
  admin,
  onlineCounselor,
  offlineCounselor,
  staleCounselor,
  deactivatedCounselor,
]

describe('listOnlinePresence', () => {
  it('super_admin sees everyone active, including who is online or not', async () => {
    const userRepository = createFakeUserRepository(seed)
    const result = await listOnlinePresence('super_admin', {
      userRepository,
      clock: createFixedClock(now),
    })

    expect(result.map((r) => r.id).sort()).toEqual(['a1', 'c1', 'c2', 'c4', 'sa1'])
    expect(result.find((r) => r.id === 'c1')?.isOnline).toBe(true)
    expect(result.find((r) => r.id === 'c2')?.isOnline).toBe(false)
  })

  it('admin does not see the super_admin at all, online or not', async () => {
    const userRepository = createFakeUserRepository(seed)
    const result = await listOnlinePresence('admin', {
      userRepository,
      clock: createFixedClock(now),
    })

    expect(result.find((r) => r.role === 'super_admin')).toBeUndefined()
    expect(result.map((r) => r.id).sort()).toEqual(['a1', 'c1', 'c2', 'c4'])
  })

  it('excludes deactivated accounts', async () => {
    const userRepository = createFakeUserRepository(seed)
    const result = await listOnlinePresence('super_admin', {
      userRepository,
      clock: createFixedClock(now),
    })

    expect(result.find((r) => r.id === 'c3')).toBeUndefined()
  })

  it('reports 0 online seconds today for a counter left over from a previous day', async () => {
    const userRepository = createFakeUserRepository(seed)
    const result = await listOnlinePresence('super_admin', {
      userRepository,
      clock: createFixedClock(now),
    })

    expect(result.find((r) => r.id === 'c4')?.onlineSecondsToday).toBe(0)
    expect(result.find((r) => r.id === 'c1')?.onlineSecondsToday).toBe(900)
  })
})
