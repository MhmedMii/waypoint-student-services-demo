import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// نسجّل النطاق اللي كل مسار يسلّمه لـ requireScope ثم نوقفه هناك — التست
// يفحص تحويل النوع لنطاق عند كل موقع نداء، مو بس رمز الحالة بالنهاية
const holder = vi.hoisted(() => ({
  scopesAsked: [] as unknown[],
  applicationKind: 'visa' as string,
}))

vi.mock('next-auth', () => ({
  getServerSession: async () => ({ user: { id: 'u', role: 'super_admin', scopes: [] } }),
}))
vi.mock('../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('../../../infrastructure/auth/requireRole', () => ({ requireRole: () => ({ ok: true }) }))
vi.mock('../../../infrastructure/auth/requireScope', () => ({
  requireScope: (_session: unknown, scope: unknown) => {
    holder.scopesAsked.push(scope)
    return { ok: false, redirectTo: '/login' }
  },
}))
vi.mock('../../../adapters/repositories/postgresApplicationRepository', () => ({
  createPostgresApplicationRepository: () => ({
    findById: async () => ({ id: 'a1', kind: holder.applicationKind }),
  }),
}))
vi.mock('../../../adapters/repositories/postgresApplicationDocumentRepository', () => ({
  createPostgresApplicationDocumentRepository: () => ({
    findById: async () => ({ id: 'd1', applicationId: 'a1' }),
  }),
}))
vi.mock('../../../infrastructure/storage/vercelBlobStorage', () => ({
  createVercelBlobStorage: () => ({}),
}))

import { GET as listByKind, PATCH as assignByKind } from './kind/[kind]/route'
import { GET as exportByKind } from './export/route'
import { GET as download } from './documents/[documentId]/download/route'
import { GET as listDocuments } from './[applicationId]/documents/route'

const get = (url: string) => new NextRequest(url)
const patch = (url: string) =>
  new NextRequest(url, { method: 'PATCH', body: JSON.stringify({ applicationId: 'a1' }) })

beforeEach(() => {
  holder.scopesAsked = []
  holder.applicationKind = 'visa'
})

// النوع يجي من الرابط
describe.each([
  [
    'GET /applications/kind/[kind]',
    (k: string) =>
      listByKind(get(`http://l/api/applications/kind/${k}`), {
        params: Promise.resolve({ kind: k }),
      }),
  ],
  [
    'PATCH /applications/kind/[kind]',
    (k: string) =>
      assignByKind(patch(`http://l/api/applications/kind/${k}`), {
        params: Promise.resolve({ kind: k }),
      }),
  ],
  [
    'GET /applications/export',
    (k: string) => exportByKind(get(`http://l/api/applications/export?kind=${k}`)),
  ],
])('%s', (_name, call) => {
  it('asks for visa_services for a visa request', async () => {
    await call('visa')
    expect(holder.scopesAsked).toEqual(['visa_services'])
  })

  it('asks for exam_services for an exam request', async () => {
    await call('exam')
    expect(holder.scopesAsked).toEqual(['exam_services'])
  })

  it('refuses an unknown kind with 400 and never asks about a scope', async () => {
    const response = await call('passport')
    expect(response.status).toBe(400)
    expect(holder.scopesAsked).toEqual([])
  })
})

// النوع يجي من قاعدة البيانات
describe.each([
  [
    'GET /documents/[documentId]/download',
    () => download(get('http://l/x'), { params: Promise.resolve({ documentId: 'd1' }) }),
  ],
  [
    'GET /[applicationId]/documents',
    () => listDocuments(get('http://l/x'), { params: Promise.resolve({ applicationId: 'a1' }) }),
  ],
])('%s', (_name, call) => {
  it('asks for visa_services for a visa application', async () => {
    holder.applicationKind = 'visa'
    await call()
    expect(holder.scopesAsked).toEqual(['visa_services'])
  })

  it('asks for exam_services for an exam application', async () => {
    holder.applicationKind = 'exam'
    await call()
    expect(holder.scopesAsked).toEqual(['exam_services'])
  })

  // القديم كان يسأل عن exam_services — والمشرف الأعلى يعدّي أي نطاق، فيفتح
  it('refuses a stored application of an unknown kind with 403', async () => {
    holder.applicationKind = 'passport'
    const response = await call()
    expect(response.status).toBe(403)
    expect(holder.scopesAsked).toEqual([])
  })
})
