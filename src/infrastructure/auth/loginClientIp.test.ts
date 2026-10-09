import { describe, it, expect, vi, beforeEach } from 'vitest'

// تسجيل الدخول كان عنده نسخة خاصة من قراءة الـ IP: بلا تست، وتعامل الهيدر
// لو جا مصفوفة كأنه مجهول — فيتطفّى حد الـ IP على تسجيل الدخول بالذات. هنا
// نشغّل authorize الحقيقي ونشوف أي IP يوصل لمحدّد تسجيل الدخول
const holder = vi.hoisted(() => ({
  ipsChecked: [] as string[],
  ipsRecorded: [] as string[],
}))

vi.mock('../db/pool', () => ({ pool: {} }))
vi.mock('./loginRateLimiter', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => {},
  clearAttempts: async () => {},
}))
vi.mock('./ipLoginRateLimiter', () => ({
  isIpRateLimited: async (ip: string) => {
    holder.ipsChecked.push(ip)
    return false
  },
  recordFailedIpAttempt: async (ip: string) => {
    holder.ipsRecorded.push(ip)
  },
  clearIpAttempts: async () => {},
}))
// إيميل غير موجود: يمشي مسار المحاولة الفاشلة اللي يسجّل الـ IP
vi.mock('../../adapters/repositories/postgresUserRepository', () => ({
  createPostgresUserRepository: () => ({ findByEmail: async () => null }),
}))
vi.mock('../../adapters/repositories/postgresSpecializationRepository', () => ({
  createPostgresSpecializationRepository: () => ({}),
}))

import { authOptions } from './authOptions'

type Authorize = (credentials: unknown, req: unknown) => Promise<unknown>
// NextAuth v4 يحط دالة فاضية بالمستوى الأعلى ويدمج دالتنا من options وقت التشغيل —
// فالاختبار لازم ينادي هذي، وإلا يفحص دالة ما تنادي أي محدد أصلاً
const authorize = (authOptions.providers[0] as unknown as { options: { authorize: Authorize } })
  .options.authorize

function attempt(headers: Record<string, unknown>) {
  return authorize({ email: 'nobody@example.com', password: 'wrong-password' }, { headers })
}

beforeEach(() => {
  holder.ipsChecked = []
  holder.ipsRecorded = []
})

describe('sign-in reads the client IP through the shared rule', () => {
  it('limits by the first address in the header', async () => {
    await attempt({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })
    expect(holder.ipsChecked).toEqual(['203.0.113.7'])
    expect(holder.ipsRecorded).toEqual(['203.0.113.7'])
  })

  // البق: النسخة القديمة ترجّع 'unknown' لما الهيدر مصفوفة، فتتخطى حد الـ IP
  it('still limits by IP when the header arrives as a list', async () => {
    await attempt({ 'x-forwarded-for': ['203.0.113.7, 10.0.0.1'] })
    expect(holder.ipsChecked).toEqual(['203.0.113.7'])
    expect(holder.ipsRecorded).toEqual(['203.0.113.7'])
  })

  // بلا هيدر: ما نحظر على سلة 'unknown' — يتشاركها الجميع، فحظرها يقفل الكل
  it('skips the IP limit, rather than sharing a bucket, when the header is missing', async () => {
    await attempt({})
    expect(holder.ipsChecked).toEqual([])
    expect(holder.ipsRecorded).toEqual([])
  })

  it('treats an empty first entry as missing, not as an empty key', async () => {
    await attempt({ 'x-forwarded-for': ' , 10.0.0.1' })
    expect(holder.ipsChecked).toEqual([])
    expect(holder.ipsRecorded).toEqual([])
  })
})
