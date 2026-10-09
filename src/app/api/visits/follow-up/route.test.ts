import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const holder = vi.hoisted(() => ({
  visits: null as any,
  users: null as any,
  logged: [] as any[],
}))

vi.mock('../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }))
vi.mock('../../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../../adapters/repositories/postgresVisitRepository', () => ({
  createPostgresVisitRepository: () => holder.visits,
}))
vi.mock('../../../../adapters/repositories/postgresUserRepository', () => ({
  createPostgresUserRepository: () => holder.users,
}))
vi.mock('../../../../infrastructure/activity/logActivity', () => ({
  logActivity: async (...args: any[]) => {
    holder.logged.push(args.slice(2))
  },
}))
vi.mock('../../../../infrastructure/rateLimit/guardPublicSubmission', () => ({
  guardPublicSubmission: async () => ({ tooMany: false }),
  guardRepeatSubmitter: async () => ({ tooMany: false }),
}))

import {
  createFakeVisitRepository,
  createFakeUserRepository,
} from '../../../../application/testing/fakes'
import type { User } from '../../../../domain/entities/user'
import { POST } from './route'

function counselor(lastSeenAt: Date | null): User {
  return {
    id: 'demoCounselorOne',
    name: 'Demo Counselor One',
    nameAr: 'مستشار تجريبي أول',
    role: 'counselor',
    email: 'demoCounselorOne@example.com',
    passwordHash: 'x',
    active: true,
    scopes: [],
    shift: null,
    lastSeenAt,
  } as unknown as User
}

function post() {
  return POST(
    new NextRequest('http://localhost/api/visits/follow-up', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sample Client',
        phone: '50000001',
        counselorId: 'demoCounselorOne',
      }),
    })
  )
}

const actionsLogged = () => holder.logged.map((entry) => entry[0])

beforeEach(() => {
  holder.logged.length = 0
  holder.visits = createFakeVisitRepository()
})

describe('POST /api/visits/follow-up', () => {
  it('logs one entry when the chosen counselor is in today', async () => {
    holder.users = createFakeUserRepository([counselor(new Date())])
    expect((await post()).status).toBe(200)
    expect(actionsLogged()).toEqual(['visit_created'])
  })

  // العميل اختار مستشاره — السجل لازم يقول مين، حتى لما كل شي تمام
  it('names the counselor the client chose, even on a normal day', async () => {
    holder.users = createFakeUserRepository([counselor(new Date())])
    await post()
    const [, , , details, detailsAr] = holder.logged[0]
    expect(details).toBe(
      'Created follow-up visit for Sample Client — assigned to Demo Counselor One'
    )
    expect(detailsAr).toContain('مستشار تجريبي أول')
  })

  it('adds the absent entry when they have been gone past the line', async () => {
    holder.users = createFakeUserRepository([counselor(new Date('2026-01-05T09:00:00Z'))])
    expect((await post()).status).toBe(200)
    expect(actionsLogged()).toEqual(['visit_created', 'follow_up_absent_counselor'])

    const [, , , details] = holder.logged[1]
    expect(details).toContain('Sample Client chose Demo Counselor One')
    expect(details).toContain(' — not in ')
  })

  it('uses the quieter action for someone who was here yesterday', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    holder.users = createFakeUserRepository([counselor(yesterday)])
    expect((await post()).status).toBe(200)
    expect(actionsLogged()[1]).toBe('follow_up_counselor_not_in')
  })

  // الحارس: هذا التغيير ما يلمس التوزيع إطلاقًا — الاختيار يمر كما هو
  it('still creates the visit for the counselor the client chose, in every case', async () => {
    for (const lastSeen of [new Date(), new Date('2026-01-05T09:00:00Z'), null]) {
      holder.logged.length = 0
      holder.visits = createFakeVisitRepository()
      holder.users = createFakeUserRepository([counselor(lastSeen)])

      const response = await post()
      expect(response.status).toBe(200)
      const queue = await holder.visits.findAssignedQueueForCounselor('demoCounselorOne')
      expect(queue).toHaveLength(1)
      expect(queue[0].type).toBe('follow_up')
      expect(queue[0].counselorId).toBe('demoCounselorOne')
    }
  })
})
