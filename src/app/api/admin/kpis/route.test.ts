// src/app/api/admin/kpis/route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../../adapters/repositories/postgresVisitRepository', () => ({
  createPostgresVisitRepository: () => ({
    async findAllInRange() {
      return []
    },
    async findAllByStudentStatus() {
      return []
    },
  }),
}))
vi.mock('../../../../adapters/repositories/postgresUserRepository', () => ({
  createPostgresUserRepository: () => ({
    async findActiveCounselors() {
      return []
    },
    // نجيب الكل عشان نقدر نعرض أسماء المعطّلين اللي لهم زيارات قديمة
    async findAll() {
      return []
    },
  }),
}))
vi.mock('../../../../adapters/repositories/postgresApplicationRepository', () => ({
  createPostgresApplicationRepository: () => ({
    async findAllInRange() {
      return []
    },
  }),
}))

import { getServerSession } from 'next-auth'
import { GET } from './route'

function kpisRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/kpis${query}`)
}

describe('GET /api/admin/kpis', () => {
  it('returns 400 for a malformed "from" date', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'admin' } } as any)

    const response = await GET(kpisRequest('?from=not-a-date'))
    expect(response.status).toBe(400)
  })

  it('returns 400 for a malformed "to" date', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'admin' } } as any)

    const response = await GET(kpisRequest('?to=not-a-date'))
    expect(response.status).toBe(400)
  })

  it('returns 200 with valid date params', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'admin' } } as any)

    const response = await GET(kpisRequest('?from=2026-08-01&to=2026-08-10'))
    expect(response.status).toBe(200)
  })
})
