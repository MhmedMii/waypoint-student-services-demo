import { describe, it, expect, vi, beforeEach } from 'vitest'

const holder = vi.hoisted(() => ({ repo: null as any, logged: [] as any[] }))

vi.mock('../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../../adapters/repositories/postgresVisitRepository', () => ({
  createPostgresVisitRepository: () => holder.repo,
}))
vi.mock('../../../../infrastructure/activity/logActivity', () => ({
  logActivity: async (...args: any[]) => {
    holder.logged.push(args.slice(2))
  },
}))

import { getServerSession } from 'next-auth'
import { createFakeVisitRepository } from '../../../../application/testing/fakes'
import { POST } from './route'

beforeEach(() => {
  holder.logged.length = 0
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'c1', role: 'counselor' } } as any)
})

async function waitingClient(name: string) {
  const repo = createFakeVisitRepository()
  await repo.create({
    type: 'new',
    name,
    phone: '50000001',
    desiredCountry: 'USA',
    counselorId: 'c1',
    linkedVisitId: null,
    requestedCounselorId: null,
    createdBy: null,
  })
  return repo
}

describe('POST /api/counselor/next', () => {
  // بدون هالصف، السجل يعرف إن الزيارة انفتحت وانقفلت وما يعرف متى جلس العميل
  it('logs who was picked up, and by whom', async () => {
    holder.repo = await waitingClient('Sample Client')

    const response = await POST()
    expect(response.status).toBe(200)

    expect(holder.logged).toHaveLength(1)
    const [action, targetType, , details, detailsAr] = holder.logged[0]
    expect(action).toBe('visit_picked_up')
    expect(targetType).toBe('visit')
    expect(details).toContain('Sample Client')
    expect(detailsAr).toContain('Sample Client')
  })

  it('logs nothing when there was no one waiting to pick up', async () => {
    holder.repo = createFakeVisitRepository()

    const response = await POST()
    expect(response.status).toBe(400)
    expect(holder.logged).toHaveLength(0)
  })

  it('logs nothing when the counselor is already with a client', async () => {
    const repo = await waitingClient('First Client')
    const queue = await repo.findAssignedQueueForCounselor('c1')
    await repo.markPickedUp(queue[0].id, new Date())
    holder.repo = repo

    const response = await POST()
    expect(response.status).toBe(400)
    expect(holder.logged).toHaveLength(0)
  })

  it('does not log a pick-up for someone who is not a counselor', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'admin' } } as any)
    holder.repo = await waitingClient('Sample Client')

    const response = await POST()
    expect(response.status).toBe(401)
    expect(holder.logged).toHaveLength(0)
  })
})
