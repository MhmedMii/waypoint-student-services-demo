import { describe, it, expect } from 'vitest'
import { getOnlineSessionsForDate } from './getOnlineSessionsForDate'
import { createFakeOnlineSessionRepository } from '../testing/fakes'
import type { OnlineSession } from '../../domain/entities/onlineSession'

describe('getOnlineSessionsForDate', () => {
  it('returns the sessions that started within the given day and their total duration', async () => {
    const seed: OnlineSession[] = [
      {
        id: 's1',
        userId: 'u1',
        startedAt: new Date('2026-08-12T09:02:00Z'),
        endedAt: new Date('2026-08-12T11:47:00Z'),
      },
      {
        id: 's2',
        userId: 'u1',
        startedAt: new Date('2026-08-12T13:05:00Z'),
        endedAt: new Date('2026-08-12T17:30:00Z'),
      },
      {
        id: 's3',
        userId: 'u1',
        startedAt: new Date('2026-08-11T09:00:00Z'),
        endedAt: new Date('2026-08-11T10:00:00Z'),
      },
      {
        id: 's4',
        userId: 'u2',
        startedAt: new Date('2026-08-12T09:00:00Z'),
        endedAt: new Date('2026-08-12T10:00:00Z'),
      },
    ]
    const onlineSessionRepository = createFakeOnlineSessionRepository(seed)

    const result = await getOnlineSessionsForDate('u1', new Date('2026-08-12T00:00:00Z'), {
      onlineSessionRepository,
    })

    expect(result.sessions.map((s) => s.id)).toEqual(['s1', 's2'])
    // session s1 = 2h45m = 9900s, session s2 = 4h25m = 15900s
    expect(result.totalSeconds).toBe(9900 + 15900)
  })

  it('returns zero total when there are no sessions that day', async () => {
    const onlineSessionRepository = createFakeOnlineSessionRepository()
    const result = await getOnlineSessionsForDate('u1', new Date('2026-08-12T00:00:00Z'), {
      onlineSessionRepository,
    })
    expect(result.sessions).toEqual([])
    expect(result.totalSeconds).toBe(0)
  })
})
