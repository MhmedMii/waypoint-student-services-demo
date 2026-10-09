import { describe, it, expect } from 'vitest'
import { recordHeartbeat } from './recordHeartbeat'
import { HEARTBEAT_INTERVAL_SECONDS } from '../../domain/time/presenceTiming'
import {
  createFakeUserRepository,
  createFakeOnlineSessionRepository,
  createFixedClock,
} from '../testing/fakes'
import type { User } from '../../domain/entities/user'

function freshCounselor(): User {
  return {
    id: 'u1',
    name: 'Counselor',
    role: 'counselor',
    email: 'c@example.com',
    passwordHash: 'x',
    active: true,
    lastSeenAt: null,
    onlineSecondsToday: 0,
    onlineDay: null,
    shift: null,
    floor: null,
  }
}

describe('recordHeartbeat', () => {
  it('updates the user last-seen timestamp to now', async () => {
    const userRepository = createFakeUserRepository([freshCounselor()])
    const onlineSessionRepository = createFakeOnlineSessionRepository()
    const now = new Date('2026-08-13T10:00:00Z')
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(now),
    })

    const updated = await userRepository.findById('u1')
    expect(updated?.lastSeenAt).toEqual(now)
  })

  it('accumulates online seconds today across heartbeats on the same day', async () => {
    const userRepository = createFakeUserRepository([freshCounselor()])
    const onlineSessionRepository = createFakeOnlineSessionRepository()
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(new Date('2026-08-13T10:00:00Z')),
    })
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(new Date('2026-08-13T10:00:30Z')),
    })

    const updated = await userRepository.findById('u1')
    expect(updated?.onlineSecondsToday).toBe(HEARTBEAT_INTERVAL_SECONDS * 2)
  })

  it('resets the counter when a new day starts', async () => {
    const userRepository = createFakeUserRepository([freshCounselor()])
    const onlineSessionRepository = createFakeOnlineSessionRepository()
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      // ٢٠:٥٩ UTC = ١١:٥٩ ليلاً بالكويت
      clock: createFixedClock(new Date('2026-08-12T20:59:00Z')),
    })
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      // ٢١:٠٠:٣٠ UTC = ٠٠:٠٠:٣٠ من اليوم الكويتي التالي
      clock: createFixedClock(new Date('2026-08-12T21:00:30Z')),
    })

    const updated = await userRepository.findById('u1')
    expect(updated?.onlineSecondsToday).toBe(HEARTBEAT_INTERVAL_SECONDS)
  })

  // البق اللي كان: العدّاد يصفّر عند منتصف ليل UTC، يعني الثالثة فجرًا
  // بالكويت. مستشار مسائي يشتغل لين الثانية يلقى وقته انمسح وهو شغّال
  it('does not reset at UTC midnight, which is 3am in Kuwait', async () => {
    const userRepository = createFakeUserRepository([freshCounselor()])
    const onlineSessionRepository = createFakeOnlineSessionRepository()
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(new Date('2026-08-12T23:59:00Z')),
    })
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(new Date('2026-08-13T00:00:30Z')),
    })

    const updated = await userRepository.findById('u1')
    expect(updated?.onlineSecondsToday).toBe(HEARTBEAT_INTERVAL_SECONDS * 2)
  })

  it('starts a new online session on the first heartbeat', async () => {
    const userRepository = createFakeUserRepository([freshCounselor()])
    const onlineSessionRepository = createFakeOnlineSessionRepository()
    const now = new Date('2026-08-13T09:00:00Z')
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(now),
    })

    const session = await onlineSessionRepository.findMostRecent('u1')
    expect(session?.startedAt).toEqual(now)
    expect(session?.endedAt).toEqual(now)
  })

  it('extends the same session when heartbeats arrive within the online threshold', async () => {
    const userRepository = createFakeUserRepository([freshCounselor()])
    const onlineSessionRepository = createFakeOnlineSessionRepository()
    const started = new Date('2026-08-13T09:00:00Z')
    const next = new Date('2026-08-13T09:00:30Z')
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(started),
    })
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(next),
    })

    const sessions = await onlineSessionRepository.findForUserInRange(
      'u1',
      new Date('2026-08-13T00:00:00Z'),
      new Date('2026-08-14T00:00:00Z')
    )
    expect(sessions).toHaveLength(1)
    expect(sessions[0].startedAt).toEqual(started)
    expect(sessions[0].endedAt).toEqual(next)
  })

  it('starts a second session after a gap longer than the online threshold', async () => {
    const userRepository = createFakeUserRepository([freshCounselor()])
    const onlineSessionRepository = createFakeOnlineSessionRepository()
    const firstSeen = new Date('2026-08-13T09:00:00Z')
    const afterGap = new Date('2026-08-13T13:00:00Z')
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(firstSeen),
    })
    await recordHeartbeat('u1', {
      userRepository,
      onlineSessionRepository,
      clock: createFixedClock(afterGap),
    })

    const sessions = await onlineSessionRepository.findForUserInRange(
      'u1',
      new Date('2026-08-13T00:00:00Z'),
      new Date('2026-08-14T00:00:00Z')
    )
    expect(sessions).toHaveLength(2)
  })
})
