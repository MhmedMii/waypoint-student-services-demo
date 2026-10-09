import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// التصدير كان يطلب "آخر ٢٠٠" ويتجاهل الفترة. هنا نمسك اللي يوصل للمستودع
// وللإكسل فعلاً — مو شكل الرد بس
const holder = vi.hoisted(() => ({
  session: null as any,
  findAllInRange: null as any,
  exported: null as any,
}))

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => holder.session) }))
vi.mock('../../../../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../../../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('../../../../../adapters/repositories/postgresActivityLogRepository', () => ({
  createPostgresActivityLogRepository: () => ({ findAllInRange: holder.findAllInRange }),
}))
vi.mock('../../../../../application/useCases/exportActivityLogToExcel', () => ({
  exportActivityLogToExcel: async (logs: unknown[]) => {
    holder.exported = logs
    return Buffer.from('xlsx')
  },
}))

import { GET } from './route'

function exportFor(query: string) {
  return GET(new NextRequest(`http://localhost/api/admin/activity-logs/export${query}`))
}

describe('GET /api/admin/activity-logs/export', () => {
  beforeEach(() => {
    holder.session = { user: { id: 'a1', role: 'admin' } }
    holder.exported = null
    // ٤٨٨ = العدد الحقيقي بالسجل وقت الإصلاح؛ أكثر من سقف الـ٢٠٠ القديم
    holder.findAllInRange = vi.fn(async () =>
      Array.from({ length: 488 }, (_, i) => ({ id: String(i) }))
    )
    vi.useFakeTimers()
    // ٢٤ سبتمبر، ٤:٣٠ الفجر بالكويت
    vi.setSystemTime(new Date('2026-09-24T01:30:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('puts every event of the period in the file, not the newest 200', async () => {
    await exportFor('?lang=en&days=all')
    expect(holder.exported).toHaveLength(488)
  })

  it('asks for the whole of "any date", with no start and no limit', async () => {
    await exportFor('?lang=en&days=all')
    expect(holder.findAllInRange).toHaveBeenCalledWith(null)
  })

  it('follows the chosen period, starting at Kuwait midnight like the screen', async () => {
    await exportFor('?lang=en&days=7')
    expect(holder.findAllInRange).toHaveBeenCalledWith(new Date('2026-09-17T21:00:00.000Z'))
  })

  it('names the period and the Kuwait day in the filename', async () => {
    const cases = [
      ['?days=all', 'activity-log-all-time-2026-09-24.xlsx'],
      ['?days=1', 'activity-log-today-2026-09-24.xlsx'],
      ['?days=7', 'activity-log-last-7-days-2026-09-24.xlsx'],
      ['?days=30', 'activity-log-last-30-days-2026-09-24.xlsx'],
    ] as const
    for (const [query, filename] of cases) {
      const response = await exportFor(query)
      expect(response.headers.get('Content-Disposition')).toBe(`attachment; filename="${filename}"`)
    }
  })

  it('refuses a counselor and reads nothing', async () => {
    holder.session = { user: { id: 'c1', role: 'counselor' } }
    const response = await exportFor('?days=all')
    expect(response.status).toBe(401)
    expect(holder.findAllInRange).not.toHaveBeenCalled()
  })
})
