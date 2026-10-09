import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Visit } from '../../../../../../domain/entities/visit'

const holder = vi.hoisted(() => ({ repo: null as any, logged: [] as any[] }))

vi.mock('../../../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../../../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../../../../adapters/repositories/postgresVisitRepository', () => ({
  createPostgresVisitRepository: () => holder.repo,
}))
vi.mock('../../../../../../infrastructure/activity/logActivity', () => ({
  logActivity: async (...args: any[]) => {
    holder.logged.push(args.slice(2))
  },
}))

import { getServerSession } from 'next-auth'
import { createFakeVisitRepository } from '../../../../../../application/testing/fakes'
import { PATCH } from './route'

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    type: 'visa',
    name: 'DEMO',
    phone: '98721391',
    desiredCountry: null,
    counselorId: 'c1',
    linkedVisitId: null,
    status: 'closed',
    studentStatus: 'closed',
    pickedUpAt: new Date('2026-09-01T09:00:00Z'),
    closedAt: new Date('2026-09-01T09:10:00Z'),
    note: null,
    followUpDueAt: null,
    createdBy: null,
    createdAt: new Date('2026-09-01T08:50:00Z'),
    updatedAt: new Date('2026-09-01T09:10:00Z'),
    ...overrides,
  }
}

function patch(body: unknown) {
  const request = new NextRequest('http://localhost/api/counselor/students/visits/v1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return PATCH(request, { params: Promise.resolve({ visitId: 'v1' }) })
}

beforeEach(() => {
  holder.logged.length = 0
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'c1', role: 'counselor' } } as any)
})

describe('PATCH /api/counselor/students/visits/[visitId]', () => {
  it('rejects a non-counselor', async () => {
    holder.repo = createFakeVisitRepository([visit()])
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a', role: 'admin' } } as any)
    expect((await patch({ studentStatus: 'closed' })).status).toBe(401)
  })

  it('rejects an unknown status value with 400', async () => {
    holder.repo = createFakeVisitRepository([visit()])
    const response = await patch({ studentStatus: 'nonsense' })
    expect(response.status).toBe(400)
  })

  it('rejects In session on a closed visit with 400 and changes nothing', async () => {
    const seed = visit()
    holder.repo = createFakeVisitRepository([seed])
    const response = await patch({ studentStatus: 'in_session' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, reason: 'studentStatusNotAllowedForVisit' })
    expect(seed.studentStatus).toBe('closed')
    expect(holder.logged).toHaveLength(0)
  })

  it('rejects Follow-up needed without a due date with 400', async () => {
    holder.repo = createFakeVisitRepository([visit()])
    const response = await patch({ studentStatus: 'follow_up_needed' })
    expect(response.status).toBe(400)
    expect((await response.json()).reason).toBe('followUpDueDateRequired')
  })

  it("rejects another counselor's visit with 403", async () => {
    holder.repo = createFakeVisitRepository([visit({ counselorId: 'someone-else' })])
    expect((await patch({ studentStatus: 'closed' })).status).toBe(403)
  })

  it('saves Follow-up needed with its due date and records who changed it', async () => {
    const seed = visit()
    holder.repo = createFakeVisitRepository([seed])
    const response = await patch({ studentStatus: 'follow_up_needed', followUpDueAt: '2026-09-25' })
    expect(response.status).toBe(200)
    expect(seed.studentStatus).toBe('follow_up_needed')
    expect(seed.followUpDueAt).toEqual(new Date('2026-09-25'))
    expect(holder.logged).toHaveLength(1)
    expect(holder.logged[0][0]).toBe('visit_status_changed')
    expect(holder.logged[0][2]).toBe('v1')
    expect(holder.logged[0][3]).toContain('DEMO')
  })
})
