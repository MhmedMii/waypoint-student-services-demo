import { describe, it, expect } from 'vitest'
import { computeElapsedTime } from './computeElapsedTime'

describe('computeElapsedTime', () => {
  it('reports not_started when startedAt is null', () => {
    expect(computeElapsedTime(null, null, new Date())).toEqual({ status: 'not_started' })
  })

  it('reports running with elapsed ms when endedAt is null', () => {
    const startedAt = new Date('2026-08-12T10:00:00Z')
    const now = new Date('2026-08-12T10:05:00Z')
    expect(computeElapsedTime(startedAt, null, now)).toEqual({
      status: 'running',
      elapsedMs: 300000,
    })
  })

  it('reports finished with elapsed ms between start and end', () => {
    const startedAt = new Date('2026-08-12T10:00:00Z')
    const closedAt = new Date('2026-08-12T10:18:30Z')
    expect(computeElapsedTime(startedAt, closedAt, new Date())).toEqual({
      status: 'finished',
      elapsedMs: 1110000,
    })
  })
})
