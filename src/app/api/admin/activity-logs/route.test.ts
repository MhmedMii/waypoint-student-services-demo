import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// المسار يحسب بداية الفترة بنفسه. بـ Vercel الساعة UTC (والاختبارات مثبّتة على UTC
// بـ vitest.config)، فـ setHours(0) كانت تعطي ٣ الفجر بالكويت — و"اليوم" يطيّح
// أحداث منتصف الليل لين الثالثة. هنا نمسك التاريخ اللي يوصل للمستودع فعلاً
const holder = vi.hoisted(() => ({
  findInRange: null as any,
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'a1', role: 'admin' } }),
}))
vi.mock('../../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('../../../../adapters/repositories/postgresActivityLogRepository', () => ({
  createPostgresActivityLogRepository: () => ({
    findInRange: holder.findInRange,
    countInRange: async () => 0,
    countAll: async () => 0,
  }),
}))
vi.mock('../../../../adapters/repositories/postgresVisitRepository', () => ({
  createPostgresVisitRepository: () => ({}),
}))
vi.mock('../../../../application/useCases/markLogRowsForStrandedClients', () => ({
  markLogRowsForStrandedClients: async (rows: unknown[]) => rows,
}))

import { GET } from './route'

async function cutoffSentFor(days: string): Promise<Date | null> {
  await GET(new NextRequest(`http://localhost/api/admin/activity-logs?days=${days}`))
  return holder.findInRange.mock.calls.at(-1)[0]
}

describe('GET /api/admin/activity-logs date ranges', () => {
  beforeEach(() => {
    holder.findInRange = vi.fn(async () => [])
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts "Today" at midnight in Kuwait, not midnight on the server clock', async () => {
    // ٢٤ سبتمبر، ٤:٣٠ الفجر بالكويت
    vi.setSystemTime(new Date('2026-09-24T01:30:00Z'))
    expect((await cutoffSentFor('1'))?.toISOString()).toBe('2026-09-23T21:00:00.000Z')
  })

  it('still means today in Kuwait between midnight and 3am, while UTC is on yesterday', async () => {
    // ٢٤ سبتمبر، ١:٣٠ بعد منتصف الليل بالكويت — بـ UTC لسا ٢٣
    vi.setSystemTime(new Date('2026-09-23T22:30:00Z'))
    expect((await cutoffSentFor('1'))?.toISOString()).toBe('2026-09-23T21:00:00.000Z')
  })

  it('counts "last 7 days" as today plus the six Kuwait days before it', async () => {
    vi.setSystemTime(new Date('2026-09-24T01:30:00Z'))
    expect((await cutoffSentFor('7'))?.toISOString()).toBe('2026-09-17T21:00:00.000Z')
  })

  it('applies no start at all for any date', async () => {
    vi.setSystemTime(new Date('2026-09-24T01:30:00Z'))
    expect(await cutoffSentFor('all')).toBeNull()
  })
})
