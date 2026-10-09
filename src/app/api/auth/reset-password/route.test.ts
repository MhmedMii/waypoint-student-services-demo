import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const holder = vi.hoisted(() => ({
  claimed: [] as unknown[],
  lookedUp: [] as unknown[],
  passwordsSet: [] as unknown[],
  hashed: [] as unknown[],
  limiterChecks: [] as unknown[],
  attemptsRecorded: [] as unknown[],
  tooMany: false,
}))

vi.mock('../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('../../../../adapters/repositories/postgresUserRepository', () => ({
  createPostgresUserRepository: () => ({
    findById: async () => ({ id: 'omar', active: true }),
    setPasswordHash: async (...args: unknown[]) => {
      holder.passwordsSet.push(args)
    },
  }),
}))
vi.mock('../../../../adapters/repositories/postgresPasswordResetTokenRepository', () => ({
  createPostgresPasswordResetTokenRepository: () => ({
    // الرابط يُقرأ أولاً بلا ما يُحرق — مجهول هنا، فيرجع null
    findByTokenHash: async (...args: unknown[]) => {
      holder.lookedUp.push(args)
      return null
    },
    claimToken: async (...args: unknown[]) => {
      holder.claimed.push(args)
      return null
    },
  }),
}))
// التوكن الحقيقي يرمي على undefined — وهذا بالضبط البق اللي نغلقه
vi.mock('../../../../infrastructure/auth/passwordResetToken', () => ({
  resetTokenGenerator: {
    generateToken: () => 'raw',
    hashToken: (raw: string) => {
      holder.hashed.push(raw)
      if (typeof raw !== 'string') throw new TypeError('hashToken needs a string')
      return `hashed:${raw}`
    },
  },
}))

vi.mock('../../../../infrastructure/auth/resetPasswordRateLimiter', () => ({
  isResetPasswordRateLimited: async (ip: string) => {
    holder.limiterChecks.push(ip)
    return holder.tooMany
  },
  recordResetPasswordAttempt: async (ip: string) => {
    holder.attemptsRecorded.push(ip)
  },
}))

import { POST } from './route'

function post(body: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  holder.claimed = []
  holder.lookedUp = []
  holder.passwordsSet = []
  holder.hashed = []
  holder.limiterChecks = []
  holder.attemptsRecorded = []
  holder.tooMany = false
})

describe('POST /api/auth/reset-password — a malformed body', () => {
  // كانت كلها 500 مع stack trace بالسجل، بدون تسجيل دخول
  it.each([
    ['not JSON at all', 'this is not json'],
    ['an empty object', '{}'],
    ['a missing token', JSON.stringify({ newPassword: 'Str0ng!Passw0rd' })],
    ['a missing password', JSON.stringify({ token: 'abc123' })],
    ['a non-string token', JSON.stringify({ token: 42, newPassword: 'Str0ng!Passw0rd' })],
    ['a null token', JSON.stringify({ token: null, newPassword: 'Str0ng!Passw0rd' })],
    ['an object token', JSON.stringify({ token: {}, newPassword: 'Str0ng!Passw0rd' })],
    ['an empty token', JSON.stringify({ token: '', newPassword: 'Str0ng!Passw0rd' })],
    ['a non-string password', JSON.stringify({ token: 'abc123', newPassword: 99 })],
    ['a JSON array', JSON.stringify(['token', 'password'])],
    ['a bare JSON null', 'null'],
  ])('answers 400, not 500, for %s', async (_label, body) => {
    const response = await POST(post(body))
    expect(response.status).toBe(400)
  })

  it('never reaches the database or the hasher', async () => {
    await POST(post('{}'))
    expect(holder.hashed).toEqual([])
    expect(holder.claimed).toEqual([])
    expect(holder.passwordsSet).toEqual([])
  })

  // لولا هذي، أقدر أرجّع 400 دايماً وأخلي التستات فوق تعدي
  it('still lets a well-formed request through to the use case', async () => {
    const response = await POST(
      post(JSON.stringify({ token: 'abc123', newPassword: 'Str0ng!Passw0rd' }))
    )
    expect(holder.hashed).toEqual(['abc123'])
    expect(holder.lookedUp).toHaveLength(1)
    // مجهول، فما يُحرق شي — هذا جوهر التغيير
    expect(holder.claimed).toEqual([])
    // التوكن مو موجود بالقاعدة، فالنتيجة رفض — المهم إنه وصل للـ use case
    expect(await response.json()).toEqual({ ok: false, reason: 'resetLinkInvalid' })
  })
})
function postFrom(ip: string, body: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  })
}

const GOOD_BODY = JSON.stringify({ token: 'abc123', newPassword: 'Str0ng!Passw0rd' })

describe('POST /api/auth/reset-password — the rate limit', () => {
  // بدون حد، كل نداء يوصل claimToken على نفس الـ Pool حق تسجيل الدخول
  it('answers 429 once the limiter says stop', async () => {
    holder.tooMany = true
    const response = await POST(postFrom('203.0.113.9', GOOD_BODY))
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ ok: false, reason: 'tooManyAttempts' })
  })

  it('changes no password and claims no token when it stops', async () => {
    holder.tooMany = true
    await POST(postFrom('203.0.113.9', GOOD_BODY))
    expect(holder.claimed).toEqual([])
    expect(holder.passwordsSet).toEqual([])
  })

  it('records the attempt and continues when under the limit', async () => {
    const response = await POST(postFrom('203.0.113.9', GOOD_BODY))
    expect(holder.limiterChecks).toEqual(['203.0.113.9'])
    expect(holder.attemptsRecorded).toEqual(['203.0.113.9'])
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, reason: 'resetLinkInvalid' })
  })

  // جسم مكسور ما يستاهل سطر بجدول الحظر — والتحقق من الشكل يسبق الحد
  it('does not consult the limiter for a malformed body', async () => {
    const response = await POST(postFrom('203.0.113.9', '{}'))
    expect(response.status).toBe(400)
    expect(holder.limiterChecks).toEqual([])
    expect(holder.attemptsRecorded).toEqual([])
  })

  // سلة "unknown" وحدة للكل: حظرها يقفل إعادة التعيين بوجه الجميع
  it('skips the limiter entirely when the IP is unknown', async () => {
    holder.tooMany = true
    const response = await POST(
      new NextRequest('http://localhost/api/auth/reset-password', {
        method: 'POST',
        body: GOOD_BODY,
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(holder.limiterChecks).toEqual([])
    expect(response.status).toBe(400)
  })
})
