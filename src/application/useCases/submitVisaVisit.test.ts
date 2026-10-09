import { describe, it, expect } from 'vitest'
import { submitVisaVisit } from './submitVisaVisit'
import {
  createFakeVisitRepository,
  createFakeSpecializationRepository,
  createFixedClock,
} from '../testing/fakes'
import type { CounselorCandidate } from '../../domain/entities/counselor'

// تسجيل الدخول ما يأثر على التوزيع. الظهور هنا بس عشان أعلام السجل تطلع false
const SEEN_TODAY = new Date('2026-08-12T08:00:00Z')

const omar: CounselorCandidate = {
  id: 'omar',
  scopes: ['visa_services'],
  lastAssignedAt: new Date('2026-08-12T08:00:00Z'),
  lastSeenAt: SEEN_TODAY,
}

function makeDeps(candidates: CounselorCandidate[] = [omar]) {
  return {
    visitRepository: createFakeVisitRepository(),
    specializationRepository: createFakeSpecializationRepository(candidates),
    clock: createFixedClock(new Date('2026-08-12T12:00:00Z')),
  }
}

describe('submitVisaVisit', () => {
  it('creates a visa visit with no country, auto-assigned to the visa_services counselor', async () => {
    const result = await submitVisaVisit(
      { name: 'Demo Student One', phone: '56012345', createdBy: 'staff-1' },
      makeDeps()
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.type).toBe('visa')
      expect(result.visit.desiredCountry).toBeNull()
      expect(result.visit.counselorId).toBe('omar')
    }
  })

  it('leaves counselorId null when no counselor has the visa_services scope', async () => {
    const result = await submitVisaVisit(
      { name: 'Demo Student One', phone: '56012345', createdBy: 'staff-1' },
      makeDeps([])
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.counselorId).toBeNull()
  })

  it('rejects an invalid phone without creating a visit', async () => {
    const deps = makeDeps()
    const result = await submitVisaVisit(
      { name: 'Demo Student One', phone: '123', createdBy: 'staff-1' },
      deps
    )
    expect(result.ok).toBe(false)
  })

  // الشفت يحدد مين يظهر لموظف الاستقبال، ما يحدد مين يستحق عميل بلا صاحب
  it('falls back to a night-shift counselor rather than leaving nobody', async () => {
    const nightOmar: CounselorCandidate = {
      id: 'omar',
      scopes: ['visa_services'],
      lastAssignedAt: null,
      lastSeenAt: SEEN_TODAY,
      shift: 'night',
    }
    const deps = {
      visitRepository: createFakeVisitRepository(),
      specializationRepository: createFakeSpecializationRepository([nightOmar]),
      clock: createFixedClock(new Date('2026-08-12T03:00:00Z')), // 6am Kuwait
    }
    const result = await submitVisaVisit(
      { name: 'Demo Student One', phone: '56012345', createdBy: 'staff-1' },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.counselorId).toBe('omar')
      expect(result.assignedWhileOffShift).toBe(true)
    }
  })

  it('assigns a night-shift counselor within their visible window', async () => {
    const nightOmar: CounselorCandidate = {
      id: 'omar',
      scopes: ['visa_services'],
      lastAssignedAt: null,
      lastSeenAt: SEEN_TODAY,
      shift: 'night',
    }
    const deps = {
      visitRepository: createFakeVisitRepository(),
      specializationRepository: createFakeSpecializationRepository([nightOmar]),
      clock: createFixedClock(new Date('2026-08-12T15:00:00Z')), // 6pm Kuwait
    }
    const result = await submitVisaVisit(
      { name: 'Demo Student One', phone: '56012345', createdBy: 'staff-1' },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.counselorId).toBe('omar')
  })

  it('blocks a second submission from the same phone while the first is still open and recent', async () => {
    const deps = makeDeps()
    deps.clock = createFixedClock(new Date())
    await deps.visitRepository.create({
      type: 'visa',
      name: 'Fictional Student C',
      phone: '56012345',
      desiredCountry: null,
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })

    const result = await submitVisaVisit(
      { name: 'Fictional Student B', phone: '56012345', createdBy: null },
      deps
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('duplicateVisitPending')
  })

  it('allows the second submission through when overrideDuplicate is set, e.g. a sibling sharing the phone', async () => {
    const deps = makeDeps()
    deps.clock = createFixedClock(new Date())
    await deps.visitRepository.create({
      type: 'visa',
      name: 'Fictional Student C',
      phone: '56012345',
      desiredCountry: null,
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })

    const result = await submitVisaVisit(
      { name: 'Fictional Student B', phone: '56012345', createdBy: null, overrideDuplicate: true },
      deps
    )
    expect(result.ok).toBe(true)
  })
})

describe('submitVisaVisit round robin', () => {
  it('takes turns among visa counselors, signed in or not, and remembers the position', async () => {
    const visa = (id: string, lastSeenAt: Date | null): CounselorCandidate => ({
      id,
      scopes: ['visa_services'],
      lastAssignedAt: null,
      lastSeenAt,
    })
    const deps = makeDeps([visa('v1', null), visa('v2', SEEN_TODAY), visa('v3', null)])
    const got = []
    for (let i = 1; i <= 4; i++) {
      const result = await submitVisaVisit(
        { name: 'Sample Client', phone: `5000000${i}`, createdBy: null },
        deps
      )
      if (result.ok) got.push(result.visit.counselorId)
    }
    expect(got).toEqual(['v1', 'v2', 'v3', 'v1'])
  })
})
