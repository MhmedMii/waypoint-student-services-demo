import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const holder = vi.hoisted(() => ({
  session: null as unknown,
  created: [] as any[],
}))

vi.mock('../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('next-auth', () => ({ getServerSession: async () => holder.session }))
vi.mock('../../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../../infrastructure/activity/logActivity', () => ({ logActivity: async () => {} }))
vi.mock('../../../../infrastructure/rateLimit/guardPublicSubmission', () => ({
  guardPublicSubmission: async () => ({ tooMany: false }),
  guardRepeatSubmitter: async () => ({ tooMany: false }),
}))
vi.mock('../../../../adapters/repositories/postgresVisitRepository', () => ({
  createPostgresVisitRepository: () => ({}),
}))
vi.mock('../../../../adapters/repositories/postgresSpecializationRepository', () => ({
  createPostgresSpecializationRepository: () => ({}),
}))
vi.mock('../../../../application/useCases/submitNewClientVisit', () => ({
  submitNewClientVisit: async (input: any) => {
    holder.created.push(input)
    return { ok: false, errors: ['stopped here — the input is what this test is about'] }
  },
}))

import { POST } from './route'

function post(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/visits/new', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const WALK_IN = { name: 'Demo Student One', phone: '50000001', desiredCountry: 'GCC' }

beforeEach(() => {
  holder.session = null
  holder.created = []
})

describe('POST /api/visits/new — who is recorded as having created the visit', () => {
  it('records nobody for a kiosk walk-in with no session at all', async () => {
    await POST(post(WALK_IN))
    expect(holder.created[0].createdBy).toBeNull()
  })

  it('records the staff member who was signed in', async () => {
    holder.session = { user: { id: 'demoCounselorOne', role: 'counselor', scopes: [] } }
    await POST(post(WALK_IN))
    expect(holder.created[0].createdBy).toBe('demoCounselorOne')
  })

  // الجلسة موجودة والمستخدم منزوع: هذا اللي يصير لحساب معطّل بعد ما التوكن
  // ينفحص. الشرط كان على الجلسة وحدها فـ session.user.id كانت ترمي، والـ any
  // خفّاها عن المترجم — الطلب كان يطيح بـ 500 بدل ما يُسجّل بلا صاحب
  it('does not throw when the session has been stripped of its user', async () => {
    holder.session = { user: undefined }
    await expect(POST(post(WALK_IN))).resolves.toBeDefined()
    expect(holder.created[0].createdBy).toBeNull()
  })

  it('does not throw when the session carries no user key at all', async () => {
    holder.session = {}
    await expect(POST(post(WALK_IN))).resolves.toBeDefined()
    expect(holder.created[0].createdBy).toBeNull()
  })
})
