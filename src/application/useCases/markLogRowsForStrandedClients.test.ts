import { describe, it, expect } from 'vitest'
import { markLogRowsForStrandedClients } from './markLogRowsForStrandedClients'
import { createFakeVisitRepository } from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'

function visit(id: string, overrides: Partial<Visit> = {}): Visit {
  return {
    id,
    type: 'new',
    name: 'Sample Client',
    phone: '50000001',
    desiredCountry: 'USA',
    counselorId: null,
    linkedVisitId: null,
    status: 'next',
    studentStatus: 'waiting',
    pickedUpAt: null,
    closedAt: null,
    note: null,
    followUpDueAt: null,
    createdBy: null,
    createdAt: new Date('2026-08-19T09:00:00Z'),
    updatedAt: new Date('2026-08-19T09:00:00Z'),
    ...overrides,
  }
}

const logRow = (targetId: string, action = 'visit_created') => ({
  action,
  targetType: 'visit' as const,
  targetId,
})

describe('markLogRowsForStrandedClients', () => {
  // الصف من ١٩ أغسطس — قبل ما يوجد سبب الغياب بالسجل أصلاً
  it('flags an old row whose client never got a counselor', async () => {
    const repository = createFakeVisitRepository([visit('v-old')])
    const [row] = await markLogRowsForStrandedClients([logRow('v-old')], repository)
    expect(row.clientStillUnassigned).toBe(true)
  })

  it('leaves a row alone once someone has been assigned', async () => {
    const repository = createFakeVisitRepository([visit('v1', { counselorId: 'demoCounselorOne' })])
    const [row] = await markLogRowsForStrandedClients([logRow('v1')], repository)
    expect(row.clientStillUnassigned).toBe(false)
  })

  // انقفلت يعني ما عاد أحد ينتظر — حتى لو ما انعيّن لها أحد أبداً
  it('leaves a closed visit alone, because nobody is waiting on it', async () => {
    const repository = createFakeVisitRepository([
      visit('v1', { status: 'closed', studentStatus: 'closed', closedAt: new Date() }),
    ])
    const [row] = await markLogRowsForStrandedClients([logRow('v1')], repository)
    expect(row.clientStillUnassigned).toBe(false)
  })

  it('ignores rows that are not about creating a visit', async () => {
    const repository = createFakeVisitRepository([visit('v1')])
    const rows = await markLogRowsForStrandedClients(
      [
        logRow('v1', 'visit_deleted'),
        { action: 'account_created', targetType: 'account', targetId: 'u1' },
      ],
      repository
    )
    expect(rows.every((row) => row.clientStillUnassigned === false)).toBe(true)
  })

  it('keeps every other field on the row', async () => {
    const repository = createFakeVisitRepository([visit('v1')])
    const [row] = await markLogRowsForStrandedClients(
      [{ ...logRow('v1'), details: 'Created new-client visit for Sample Client' }],
      repository
    )
    expect(row.details).toBe('Created new-client visit for Sample Client')
  })

  it('asks the database nothing when there are no visit rows', async () => {
    const repository = createFakeVisitRepository([])
    const rows = await markLogRowsForStrandedClients([], repository)
    expect(rows).toEqual([])
  })
})
