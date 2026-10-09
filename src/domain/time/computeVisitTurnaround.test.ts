import { describe, it, expect } from 'vitest'
import { computeVisitTurnaround } from './computeVisitTurnaround'

describe('computeVisitTurnaround', () => {
  it('reports within24h when closed under 24 hours after being created', () => {
    const visit = {
      status: 'closed' as const,
      createdAt: new Date('2026-08-12T09:00:00Z'),
      closedAt: new Date('2026-08-12T09:24:00Z'),
    }
    const result = computeVisitTurnaround(visit, new Date('2026-08-12T10:00:00Z'))
    expect(result.status).toBe('within24h')
    expect(result.hours).toBeCloseTo(0.4, 5)
  })

  it('reports over24h when closed 24 hours or more after being created', () => {
    const visit = {
      status: 'closed' as const,
      createdAt: new Date('2026-08-12T00:00:00Z'),
      closedAt: new Date('2026-08-13T02:00:00Z'),
    }
    const result = computeVisitTurnaround(visit, new Date('2026-08-13T03:00:00Z'))
    expect(result).toEqual({ status: 'over24h', hours: 26 })
  })

  it('treats exactly 24 hours as over24h, not within24h', () => {
    const visit = {
      status: 'closed' as const,
      createdAt: new Date('2026-08-12T00:00:00Z'),
      closedAt: new Date('2026-08-13T00:00:00Z'),
    }
    const result = computeVisitTurnaround(visit, new Date('2026-08-13T01:00:00Z'))
    expect(result.status).toBe('over24h')
  })

  it('reports in_progress with elapsed time so far when still open', () => {
    const visit = {
      status: 'next' as const,
      createdAt: new Date('2026-08-12T08:00:00Z'),
      closedAt: null,
    }
    const result = computeVisitTurnaround(visit, new Date('2026-08-12T12:00:00Z'))
    expect(result).toEqual({ status: 'in_progress', hours: 4 })
  })

  it('reports in_progress even for a "closed" status with no closedAt recorded', () => {
    const visit = {
      status: 'closed' as const,
      createdAt: new Date('2026-08-12T08:00:00Z'),
      closedAt: null,
    }
    const result = computeVisitTurnaround(visit, new Date('2026-08-12T12:00:00Z'))
    expect(result.status).toBe('in_progress')
  })
})
