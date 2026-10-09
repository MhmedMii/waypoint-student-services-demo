// src/app/api/admin/export/route.test.ts
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
    async findAllByPhone() {
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
    async findAllByPhone() {
      return []
    },
  }),
}))
const logActivity = vi.fn()
vi.mock('../../../../infrastructure/activity/logActivity', () => ({
  logActivity: (...args: unknown[]) => logActivity(...args),
}))

import { getServerSession } from 'next-auth'
import { GET } from './route'

function exportRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/export${query}`)
}

describe('GET /api/admin/export', () => {
  it('returns 400 for a malformed "from" date', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'admin' } } as any)

    const response = await GET(exportRequest('?from=not-a-date'))
    expect(response.status).toBe(400)
  })

  it('returns 400 for a malformed "to" date', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'admin' } } as any)

    const response = await GET(exportRequest('?to=not-a-date'))
    expect(response.status).toBe(400)
  })

  it('returns a spreadsheet for valid date params', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'admin' } } as any)

    const response = await GET(exportRequest('?from=2026-08-01&to=2026-08-10'))
    expect(response.status).toBe(200)
  })

  // كان التصدير يطلع بيانات كل عميل — الاسم والهاتف — بدون أي أثر بسجل النشاط
  it('logs who exported client data, and for what range', async () => {
    logActivity.mockClear()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    } as any)

    await GET(exportRequest('?from=2026-08-01&to=2026-08-10'))

    expect(logActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user: expect.objectContaining({ id: 'admin-1' }) }),
      'client_data_exported',
      'account',
      'admin-1',
      expect.stringContaining('2026-08-01'),
      expect.stringContaining('2026-08-01')
    )
  })
})
