import { describe, it, expect } from 'vitest'
import { submitApplication } from './submitApplication'
import {
  createFakeApplicationRepository,
  createFakeSpecializationRepository,
  createFixedClock,
} from '../testing/fakes'
import type { CounselorCandidate } from '../../domain/entities/counselor'

// تسجيل الدخول ما يأثر على التوزيع. الظهور هنا بس عشان أعلام السجل تطلع false
const SEEN_TODAY = new Date('2026-08-12T08:00:00Z')

const omar: CounselorCandidate = {
  id: 'omar',
  scopes: ['visa_services', 'exam_services'],
  lastAssignedAt: new Date('2026-08-12T08:00:00Z'),
  lastSeenAt: SEEN_TODAY,
}

function makeDeps(candidates: CounselorCandidate[] = [omar]) {
  return {
    applicationRepository: createFakeApplicationRepository(),
    specializationRepository: createFakeSpecializationRepository(candidates),
    clock: createFixedClock(new Date('2026-08-12T12:00:00Z')),
  }
}

describe('submitApplication', () => {
  it('creates a visa application with pending status, auto-assigned to the visa_services counselor', async () => {
    const deps = makeDeps()
    const result = await submitApplication(
      {
        kind: 'visa',
        serviceCode: 'uk-student',
        name: 'Fictional Student R',
        phone: '51234567',
        fields: { passportNumber: 'A123' },
      },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.application.status).toBe('pending')
      expect(result.application.kind).toBe('visa')
      expect(result.application.counselorId).toBe('omar')
    }
  })

  it('creates an exam application, auto-assigned to the exam_services counselor', async () => {
    const deps = makeDeps()
    const result = await submitApplication(
      {
        kind: 'exam',
        serviceCode: 'ielts',
        name: 'Fictional Student L',
        phone: '61234567',
        fields: {},
      },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.application.counselorId).toBe('omar')
    }
  })

  it('leaves the application unassigned when no counselor holds the matching scope', async () => {
    const deps = makeDeps([])
    const result = await submitApplication(
      {
        kind: 'visa',
        serviceCode: 'uk-student',
        name: 'Fictional Student R',
        phone: '51234567',
        fields: {},
      },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.application.counselorId).toBeNull()
    }
  })

  it('rejects invalid input without touching the repository', async () => {
    const deps = makeDeps()
    const result = await submitApplication(
      { kind: 'visa', serviceCode: 'uk-student', name: 'Sara', phone: '51234567', fields: {} },
      deps
    )
    expect(result.ok).toBe(false)
    expect(await deps.applicationRepository.findAllByKind('visa')).toHaveLength(0)
  })

  it('rejects a serviceCode from the wrong catalog', async () => {
    const deps = makeDeps()
    const result = await submitApplication(
      {
        kind: 'visa',
        serviceCode: 'ielts',
        name: 'Fictional Student R',
        phone: '51234567',
        fields: {},
      },
      deps
    )
    expect(result.ok).toBe(false)
  })

  // الشفت يحدد مين يظهر لموظف الاستقبال، ما يحدد مين يستحق عميل بلا صاحب
  it('falls back to a night-shift counselor rather than leaving nobody', async () => {
    const nightOmar: CounselorCandidate = {
      id: 'omar',
      scopes: ['visa_services', 'exam_services'],
      lastAssignedAt: null,
      lastSeenAt: SEEN_TODAY,
      shift: 'night',
    }
    const deps = {
      applicationRepository: createFakeApplicationRepository(),
      specializationRepository: createFakeSpecializationRepository([nightOmar]),
      clock: createFixedClock(new Date('2026-08-12T03:00:00Z')), // 6am Kuwait
    }
    const result = await submitApplication(
      {
        kind: 'visa',
        serviceCode: 'uk-student',
        name: 'Fictional Student R',
        phone: '51234567',
        fields: {},
      },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.application.counselorId).not.toBeNull()
      expect(result.assignedWhileOffShift).toBe(true)
    }
  })
})

describe('submitApplication round robin', () => {
  it('takes turns among exam counselors, signed in or not, and remembers the position', async () => {
    const exam = (id: string, lastSeenAt: Date | null): CounselorCandidate => ({
      id,
      scopes: ['exam_services'],
      lastAssignedAt: null,
      lastSeenAt,
    })
    const deps = makeDeps([exam('e1', null), exam('e2', null)])
    const got = []
    for (let i = 1; i <= 3; i++) {
      const result = await submitApplication(
        {
          kind: 'exam',
          serviceCode: 'ielts',
          name: 'Sample Applicant',
          phone: `5000000${i}`,
          fields: {},
        },
        deps
      )
      if (result.ok) got.push(result.application.counselorId)
    }
    expect(got).toEqual(['e1', 'e2', 'e1'])
  })
})
