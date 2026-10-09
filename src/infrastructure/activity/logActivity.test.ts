import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import type { Session } from 'next-auth'

const create = vi.fn()
vi.mock('../../adapters/repositories/postgresActivityLogRepository', () => ({
  createPostgresActivityLogRepository: () => ({ create }),
}))

import { logActivity } from './logActivity'

const pool = {} as Pool
const session = { user: { id: 'u1', name: 'Dev Admin', role: 'super_admin' } } as unknown as Session

describe('logActivity', () => {
  beforeEach(() => {
    create.mockReset()
  })

  it('records the signed-in user as the actor', async () => {
    await logActivity(
      pool,
      session,
      'visit_closed',
      'visit',
      'v1',
      'Closed visit for Fictional Student G'
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'u1', actorName: 'Dev Admin', actorRole: 'super_admin' })
    )
  })

  // الانحدار الأساسي: قبل، الاستدعاء بدون جلسة كان ينتهي بلا صف بالسجل إطلاقاً
  it('records a system actor when there is no session instead of dropping the event', async () => {
    await logActivity(
      pool,
      null,
      'visit_created',
      'visit',
      'v2',
      'Created new-client visit for Fictional Student O'
    )
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorRole: 'system',
        action: 'visit_created',
        targetId: 'v2',
      })
    )
  })

  it('still carries the details through for a system actor', async () => {
    await logActivity(
      pool,
      null,
      'application_submitted',
      'application',
      'a1',
      'Submitted visa application for Sara'
    )
    expect(create.mock.calls[0][0].details).toBe('Submitted visa application for Sara')
  })
})
