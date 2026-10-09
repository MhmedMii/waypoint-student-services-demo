import { describe, it, expect } from 'vitest'
import { createDemoData, PEOPLE } from './fixtures'
import { reduceDemo } from './model'
import { readDemoData } from './DemoProvider'

describe('fictional demo workflows', () => {
  it('starts one session and prevents overlapping sessions or breaks', () => {
    const original = createDemoData()
    const started = reduceDemo(original, { type: 'start', counselorId: 'team-01', now: Date.now() })
    expect(started.visits.filter((v) => v.state === 'in_session')).toHaveLength(1)
    expect(reduceDemo(started, { type: 'start', counselorId: 'team-01', now: Date.now() })).toBe(
      started
    )
    expect(reduceDemo(started, { type: 'break', counselorId: 'team-01', now: Date.now() })).toBe(
      started
    )
    expect(original.visits.some((v) => v.state === 'in_session')).toBe(false)
  })
  it('finishes without automatically starting the next student', () => {
    const data = reduceDemo(createDemoData(), {
      type: 'start',
      counselorId: 'team-01',
      now: Date.now(),
    })
    const finished = reduceDemo(data, {
      type: 'finish',
      counselorId: 'team-01',
      state: 'follow_up_needed',
      dueAt: '2026-10-10',
      note: 'Fictional note',
      now: Date.now() + 120000,
    })
    expect(finished.visits.some((v) => v.state === 'in_session')).toBe(false)
    expect(
      finished.visits.some((v) => v.dueAt === '2026-10-10' && v.note === 'Fictional note')
    ).toBe(true)
  })
  it('accepts predefined identities and routes a new visit by specialization', () => {
    const data = createDemoData()
    const updated = reduceDemo(data, {
      type: 'register',
      personId: PEOPLE[0].id,
      kind: 'new',
      country: 'United Kingdom',
      counselorId: null,
      now: Date.now(),
    })
    expect(updated.visits[0].counselorId).toBe('team-01')
    expect(
      reduceDemo(data, {
        type: 'register',
        personId: 'unknown-person',
        kind: 'new',
        country: 'United Kingdom',
        counselorId: null,
        now: Date.now(),
      })
    ).toBe(data)
  })
  it('enforces review stages before reaching a final application decision', () => {
    const data = createDemoData()
    const application = data.applications.find((a) => a.status === 'pending')!
    expect(
      reduceDemo(data, {
        type: 'application-status',
        id: application.id,
        status: 'approved',
        now: Date.now(),
      })
    ).toBe(data)
    const reviewed = reduceDemo(data, {
      type: 'application-status',
      id: application.id,
      status: 'under_review',
      now: Date.now(),
    })
    expect(reviewed.applications.find((a) => a.id === application.id)?.status).toBe('under_review')
  })
  it('rejects malformed browser storage and identities outside the synthetic dataset', () => {
    expect(readDemoData('{broken')).toBeNull()
    expect(readDemoData(JSON.stringify({ version: 1 }))).toBeNull()
    const data = createDemoData()
    data.visits[0].personId = 'unknown-person'
    expect(readDemoData(JSON.stringify(data))).toBeNull()
    expect(readDemoData(JSON.stringify(createDemoData()))).not.toBeNull()
  })
})
