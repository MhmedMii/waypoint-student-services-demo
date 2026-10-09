import { describe, it, expect } from 'vitest'
import { computeApplicationTurnaround } from './computeApplicationTurnaround'
import type { Application } from '../entities/application'

function application(overrides: Partial<Application>): Application {
  return {
    id: 'a',
    applicationNumber: 'VISA-0001',
    kind: 'visa',
    serviceCode: 'uk-student',
    name: 'Client',
    phone: '56012345',
    email: null,
    fields: {},
    status: 'pending',
    statusNote: null,
    referenceNumber: null,
    counselorId: null,
    paymentUrl: null,
    acceptedAt: null,
    closedAt: null,
    createdAt: new Date('2026-08-18T00:00:00Z'),
    updatedAt: new Date('2026-08-18T00:00:00Z'),
    ...overrides,
  }
}

describe('computeApplicationTurnaround', () => {
  it('reports within24h when approved inside 24 hours of submission', () => {
    const app = application({
      status: 'approved',
      createdAt: new Date('2026-08-18T00:00:00Z'),
      updatedAt: new Date('2026-08-18T06:00:00Z'),
    })
    const result = computeApplicationTurnaround(app, new Date('2026-08-18T12:00:00Z'))
    expect(result).toEqual({ status: 'within24h', hours: 6 })
  })

  it('reports over24h when rejected after more than 24 hours', () => {
    const app = application({
      status: 'rejected',
      createdAt: new Date('2026-08-17T00:00:00Z'),
      updatedAt: new Date('2026-08-18T15:00:00Z'),
    })
    const result = computeApplicationTurnaround(app, new Date('2026-08-19T00:00:00Z'))
    expect(result).toEqual({ status: 'over24h', hours: 39 })
  })

  it('reports in_progress with elapsed time so far when still open', () => {
    const app = application({
      status: 'under_review',
      createdAt: new Date('2026-08-18T08:00:00Z'),
    })
    const result = computeApplicationTurnaround(app, new Date('2026-08-18T12:00:00Z'))
    expect(result).toEqual({ status: 'in_progress', hours: 4 })
  })

  it('treats exactly 24 hours as within24h', () => {
    const app = application({
      status: 'approved',
      createdAt: new Date('2026-08-18T00:00:00Z'),
      updatedAt: new Date('2026-08-19T00:00:00Z'),
    })
    const result = computeApplicationTurnaround(app, new Date('2026-08-19T01:00:00Z'))
    expect(result.status).toBe('within24h')
  })
})
