// src/app/api/auth/forgot-password/route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { sendPasswordResetEmail } = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

// محاكاة بسيطة لجدول rate_limit_lockouts بالذاكرة — عشان اختبار محدد المعدّل
// الحقيقي (المخزّن بقاعدة البيانات) بدون قاعدة بيانات فعلية وقت الاختبار
const lockoutRows = new Map<
  string,
  { failure_count: number; blocked_until: Date | null; updated_at: Date }
>()
vi.mock('../../../../infrastructure/db/pool', () => ({
  pool: {
    async query(sql: string, params: unknown[]) {
      const key = params[0] as string
      if (sql.startsWith('SELECT blocked_until')) {
        return { rows: lockoutRows.has(key) ? [lockoutRows.get(key)] : [] }
      }
      if (sql.startsWith('SELECT failure_count')) {
        return { rows: lockoutRows.has(key) ? [lockoutRows.get(key)] : [] }
      }
      if (sql.startsWith('INSERT INTO rate_limit_lockouts')) {
        const [, failureCount, blockedUntil, updatedAt] = params as [
          string,
          number,
          Date | null,
          Date,
        ]
        lockoutRows.set(key, {
          failure_count: failureCount,
          blocked_until: blockedUntil,
          updated_at: updatedAt,
        })
        return { rows: [] }
      }
      throw new Error(`Unexpected query in test: ${sql}`)
    },
  },
}))
vi.mock('../../../../adapters/repositories/postgresUserRepository', () => ({
  createPostgresUserRepository: () => ({
    async findByEmail(email: string) {
      return {
        id: 'user-1',
        name: 'Staff Member',
        role: 'counselor',
        email,
        passwordHash: 'x',
        active: true,
      }
    },
  }),
}))
vi.mock('../../../../adapters/repositories/postgresPasswordResetTokenRepository', () => ({
  createPostgresPasswordResetTokenRepository: () => ({
    async create() {
      return {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'h',
        expiresAt: new Date(),
        usedAt: null,
      }
    },
  }),
}))
vi.mock('../../../../infrastructure/email/nodemailerEmailSender', () => ({
  nodemailerEmailSender: { sendPasswordResetEmail },
}))

import { POST } from './route'

function forgotPasswordRequest(email: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

describe('POST /api/auth/forgot-password', () => {
  it('is a no-op past the rate limit but still returns the same 200 shape', async () => {
    const email = 'rate-limited-staff@example.com'

    for (let i = 0; i < 5; i++) {
      const response = await POST(forgotPasswordRequest(email))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
    }
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(5)

    const sixthResponse = await POST(forgotPasswordRequest(email))
    expect(sixthResponse.status).toBe(200)
    expect(await sixthResponse.json()).toEqual({ ok: true })
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(5)
  })
})
// جسم فاضي {} كان يوصل email = undefined للـ rate limiter، وهناك email.trim()
// يرمي — 500 بلا تسجيل دخول، يولّدها أي أحد بطلب واحد
function rawRequest(body: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/auth/forgot-password — a malformed body', () => {
  it.each([
    ['not JSON at all', 'this is not json'],
    ['an empty object', '{}'],
    ['a null email', JSON.stringify({ email: null })],
    ['a numeric email', JSON.stringify({ email: 12345 })],
    ['an object email', JSON.stringify({ email: { address: 'a@example.com' } })],
    ['an empty email', JSON.stringify({ email: '' })],
    ['an email of only spaces', JSON.stringify({ email: '   ' })],
    ['a JSON array', JSON.stringify(['a@example.com'])],
    ['a bare JSON null', 'null'],
  ])('answers 400, not 500, for %s', async (_label, body) => {
    const response = await POST(rawRequest(body))
    expect(response.status).toBe(400)
  })

  it('sends no email and touches no lockout row on a bad request', async () => {
    const before = sendPasswordResetEmail.mock.calls.length
    const rowsBefore = lockoutRows.size
    await POST(rawRequest('{}'))
    expect(sendPasswordResetEmail.mock.calls.length).toBe(before)
    expect(lockoutRows.size).toBe(rowsBefore)
  })

  // الـ ٤٠٠ للطلب المكسور فقط. عنوان سليم يظل يرد ٢٠٠ ok سواء له حساب أو لا،
  // وإلا صار المسار يكشف من عنده حساب ومن ما عنده
  it('still answers 200 ok for a well-formed address', async () => {
    const response = await POST(rawRequest(JSON.stringify({ email: 'well-formed@example.com' })))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
