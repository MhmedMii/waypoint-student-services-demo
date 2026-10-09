import { describe, it, expect } from 'vitest'
import { computeHandlingStats } from './computeHandlingStats'
import type { Visit } from '../entities/visit'

function visit(overrides: Partial<Visit>): Visit {
  return {
    id: 'v',
    type: 'new',
    name: 'Client',
    phone: '56012345',
    desiredCountry: null,
    counselorId: 'c1',
    linkedVisitId: null,
    status: 'closed',
    studentStatus: 'closed',
    pickedUpAt: new Date('2026-09-12T09:00:00Z'),
    closedAt: new Date('2026-09-12T09:20:00Z'),
    followUpDueAt: null,
    createdBy: null,
    createdAt: new Date('2026-09-12T09:00:00Z'),
    updatedAt: new Date('2026-09-12T09:20:00Z'),
    ...overrides,
  }
}

describe('computeHandlingStats', () => {
  it('averages only the sessions between 2 minutes and 8 hours', () => {
    const visits = [
      visit({
        pickedUpAt: new Date('2026-09-12T09:00:00Z'),
        closedAt: new Date('2026-09-12T09:20:00Z'),
      }),
      visit({
        pickedUpAt: new Date('2026-09-12T10:00:00Z'),
        closedAt: new Date('2026-09-12T10:10:00Z'),
      }),
    ]
    const stats = computeHandlingStats(visits)
    expect(stats.avgHandlingMs).toBe(15 * 60000)
    expect(stats.instantCloseCount).toBe(0)
    expect(stats.leftOpenCount).toBe(0)
  })

  // تارك: 5 زيارات كلها استُلمت وأُغلقت بنفس الدقيقة — صفر جلسات حقيقية للمتوسط
  it('reports instant closes for sessions under 2 minutes, like all of Demo Counselor D’s', () => {
    const visits = Array.from({ length: 5 }, (_, i) =>
      visit({
        id: `t${i}`,
        pickedUpAt: new Date('2026-09-16T08:53:00Z'),
        closedAt: new Date('2026-09-16T08:53:12Z'),
      })
    )
    const stats = computeHandlingStats(visits)
    expect(stats.avgHandlingMs).toBeNull()
    expect(stats.instantCloseCount).toBe(5)
    expect(stats.instantCloseAvgMs).toBe(12000)
    expect(stats.leftOpenCount).toBe(0)
  })

  // فاي: 4 إغلاقات فورية + عمران (~21 ساعة، متروك مفتوح) + ريماس (~6 ساعات، حقيقية)
  it('mirrors Demo Counselor G: mostly instant closes plus one left-open outlier, average reflects only the real session', () => {
    const visits = [
      ...Array.from({ length: 4 }, (_, i) =>
        visit({
          id: `fai-instant-${i}`,
          pickedUpAt: new Date('2026-09-13T16:07:00Z'),
          closedAt: new Date('2026-09-13T16:07:08Z'),
        })
      ),
      visit({
        id: 'omran',
        pickedUpAt: new Date('2026-09-15T10:00:00Z'),
        closedAt: new Date('2026-09-16T07:00:00Z'),
      }),
      visit({
        id: 'reemas',
        pickedUpAt: new Date('2026-09-16T09:00:00Z'),
        closedAt: new Date('2026-09-16T15:00:00Z'),
      }),
    ]
    const stats = computeHandlingStats(visits)
    expect(stats.avgHandlingMs).toBe(6 * 3600000)
    expect(stats.instantCloseCount).toBe(4)
    expect(stats.leftOpenCount).toBe(1)
    expect(stats.leftOpenAvgMs).toBe(21 * 3600000)
  })

  it('treats exactly 2 minutes as a real session, not an instant close', () => {
    const stats = computeHandlingStats([
      visit({
        pickedUpAt: new Date('2026-09-12T09:00:00Z'),
        closedAt: new Date('2026-09-12T09:02:00Z'),
      }),
    ])
    expect(stats.instantCloseCount).toBe(0)
    expect(stats.avgHandlingMs).toBe(2 * 60000)
  })

  it('treats exactly 8 hours as left-open, not a real session', () => {
    const stats = computeHandlingStats([
      visit({
        pickedUpAt: new Date('2026-09-12T09:00:00Z'),
        closedAt: new Date('2026-09-12T17:00:00Z'),
      }),
    ])
    expect(stats.leftOpenCount).toBe(1)
    expect(stats.avgHandlingMs).toBeNull()
  })

  it('still counts everything as closed, outliers included', () => {
    const visits = [
      visit({
        pickedUpAt: new Date('2026-09-16T08:53:00Z'),
        closedAt: new Date('2026-09-16T08:53:12Z'),
      }),
      visit({
        pickedUpAt: new Date('2026-09-12T09:00:00Z'),
        closedAt: new Date('2026-09-12T09:20:00Z'),
      }),
    ]
    expect(computeHandlingStats(visits).closedCount).toBe(2)
  })
})
