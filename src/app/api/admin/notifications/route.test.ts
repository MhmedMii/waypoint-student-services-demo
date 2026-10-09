import { describe, it, expect, vi, beforeEach } from 'vitest'

const holder = vi.hoisted(() => ({ visits: null as any, users: null as any }))

vi.mock('../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../../adapters/repositories/postgresVisitRepository', () => ({
  createPostgresVisitRepository: () => holder.visits,
}))
vi.mock('../../../../adapters/repositories/postgresUserRepository', () => ({
  createPostgresUserRepository: () => holder.users,
}))

import { getServerSession } from 'next-auth'
import {
  createFakeVisitRepository,
  createFakeUserRepository,
} from '../../../../application/testing/fakes'
import { GET } from './route'

beforeEach(() => {
  holder.visits = createFakeVisitRepository()
  holder.users = createFakeUserRepository([])
})

describe('GET /api/admin/notifications', () => {
  // إخفاء الجرس بالواجهة تنظيم للشاشة. الرفض هنا هو الحماية
  it('refuses a counselor', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'c1', role: 'counselor' } } as any)
    expect((await GET()).status).toBe(401)
  })

  it('refuses a signed-out visitor', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as any)
    expect((await GET()).status).toBe(401)
  })

  it('answers an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'admin' } } as any)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ unassignedClients: 0 })
  })

  it('answers a super admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 's1', role: 'super_admin' },
    } as any)
    expect((await GET()).status).toBe(200)
  })
})
