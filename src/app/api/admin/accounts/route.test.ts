// src/app/api/admin/accounts/route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../../adapters/repositories/postgresUserRepository', () => ({
  createPostgresUserRepository: () => ({
    async create(input: { name: string; role: string; email: string; passwordHash: string }) {
      return {
        id: 'user-1',
        name: input.name,
        role: input.role,
        email: input.email,
        passwordHash: 'bcrypt-hash-of-temp-password',
        active: true,
      }
    },
  }),
}))
vi.mock('../../../../adapters/repositories/postgresSpecializationRepository', () => ({
  createPostgresSpecializationRepository: () => ({
    async setScopes() {},
  }),
}))
vi.mock('../../../../adapters/repositories/postgresActivityLogRepository', () => ({
  createPostgresActivityLogRepository: () => ({
    async create() {
      return {}
    },
  }),
}))

import { getServerSession } from 'next-auth'
import { POST } from './route'

function postAccountRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/accounts', () => {
  it('never includes passwordHash in the JSON response body', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'super_admin' } } as any)

    const response = await POST(
      postAccountRequest({
        name: 'New Counselor',
        role: 'counselor',
        email: 'new.counselor@example.com',
        password: 'temp-pass-123',
      })
    )
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.user).not.toHaveProperty('passwordHash')
    expect(Object.keys(body.user)).toEqual(['id', 'name', 'role', 'email', 'active'])
  })

  it('accepts a counselor account with valid scopes', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'super_admin' } } as any)

    const response = await POST(
      postAccountRequest({
        name: 'New Counselor',
        role: 'counselor',
        email: 'new.counselor@example.com',
        password: 'temp-pass-123',
        scopes: ['visa_services', 'GCC'],
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('rejects an unknown scope value with 400', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'super_admin' } } as any)

    const response = await POST(
      postAccountRequest({
        name: 'New Counselor',
        role: 'counselor',
        email: 'new.counselor@example.com',
        password: 'temp-pass-123',
        scopes: ['not_a_real_scope'],
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
  })
})
