import { describe, it, expect } from 'vitest'
import { submitFollowUpVisit } from './submitFollowUpVisit'
import {
  createFakeVisitRepository,
  createFakeUserRepository,
  createFixedClock,
} from '../testing/fakes'

const NOW = new Date('2026-08-05T12:00:00Z')
import type { Visit } from '../../domain/entities/visit'
import type { User } from '../../domain/entities/user'

const priorVisit: Visit = {
  id: 'visit-1',
  type: 'new',
  name: 'Demo Student One',
  phone: '56012345',
  desiredCountry: 'US',
  counselorId: 'demoCounselorOne',
  linkedVisitId: null,
  status: 'next',
  studentStatus: 'waiting',
  pickedUpAt: null,
  closedAt: null,
  followUpDueAt: null,
  createdBy: 'staff-1',
  createdAt: new Date('2026-08-01T10:00:00Z'),
  updatedAt: new Date('2026-08-01T10:00:00Z'),
}

const activeCounselor: User = {
  id: 'demoCounselorOne',
  name: 'Demo Counselor One',
  role: 'counselor',
  email: 'demoCounselorOne@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

const earlierFollowUp: Visit = {
  id: 'visit-2',
  type: 'follow_up',
  name: 'Demo Student One',
  phone: '56012345',
  desiredCountry: null,
  counselorId: 'demoCounselorOne',
  linkedVisitId: 'visit-1',
  status: 'closed',
  studentStatus: 'closed',
  pickedUpAt: null,
  closedAt: new Date('2026-08-05T10:00:00Z'),
  followUpDueAt: null,
  createdBy: 'staff-1',
  createdAt: new Date('2026-08-05T09:00:00Z'),
  updatedAt: new Date('2026-08-05T09:00:00Z'),
}

describe('submitFollowUpVisit', () => {
  it('links to the most recent prior visit by phone', async () => {
    const visitRepository = createFakeVisitRepository([priorVisit])
    const userRepository = createFakeUserRepository([activeCounselor])
    const result = await submitFollowUpVisit(
      {
        name: 'Demo Student One',
        phone: '56012345',
        counselorId: 'demoCounselorOne',
        createdBy: 'staff-1',
      },
      { visitRepository, userRepository, clock: createFixedClock(NOW) }
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.linkedVisitId).toBe('visit-1')
  })

  it('links a second follow-up to the original new visit, not the most recent follow-up', async () => {
    const visitRepository = createFakeVisitRepository([priorVisit, earlierFollowUp])
    const userRepository = createFakeUserRepository([activeCounselor])
    const result = await submitFollowUpVisit(
      {
        name: 'Demo Student One',
        phone: '56012345',
        counselorId: 'demoCounselorOne',
        createdBy: 'staff-1',
      },
      { visitRepository, userRepository, clock: createFixedClock(NOW) }
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.linkedVisitId).toBe('visit-1')
  })

  it('saves standalone with no link when no prior visit exists for the phone', async () => {
    const visitRepository = createFakeVisitRepository()
    const userRepository = createFakeUserRepository([activeCounselor])
    const result = await submitFollowUpVisit(
      {
        name: 'Demo Student One',
        phone: '56012345',
        counselorId: 'demoCounselorOne',
        createdBy: 'staff-1',
      },
      { visitRepository, userRepository, clock: createFixedClock(NOW) }
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.linkedVisitId).toBeNull()
  })

  it('rejects a missing counselor, and says which check refused it', async () => {
    const visitRepository = createFakeVisitRepository()
    const userRepository = createFakeUserRepository([activeCounselor])
    const result = await submitFollowUpVisit(
      { name: 'Demo Student One', phone: '56012345', counselorId: '', createdBy: 'staff-1' },
      { visitRepository, userRepository, clock: createFixedClock(NOW) }
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('counselorRequired')
    expect(await visitRepository.countAll()).toBe(0)
  })

  // معرّفات المستشارين عامة (الكشك يقرأها بدون تسجيل دخول)، فأي أحد يقدر
  // يرسل أي معرّف. الفحص ثلاث شروط، وكان مختبر منها واحد بس
  describe('the counselor id is checked, not trusted', () => {
    async function submitWith(users: User[], counselorId: string) {
      const visitRepository = createFakeVisitRepository()
      const result = await submitFollowUpVisit(
        { name: 'Demo Student One', phone: '56012345', counselorId, createdBy: null },
        {
          visitRepository,
          userRepository: createFakeUserRepository(users),
          clock: createFixedClock(NOW),
        }
      )
      return { result, written: await visitRepository.countAll() }
    }

    it('refuses a deactivated counselor', async () => {
      const { result, written } = await submitWith(
        [{ ...activeCounselor, active: false }],
        'demoCounselorOne'
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors).toContain('counselorNotAvailable')
      expect(written).toBe(0)
    })

    it('refuses an admin, even though the id is real', async () => {
      const { result, written } = await submitWith(
        [{ ...activeCounselor, id: 'boss', role: 'super_admin' }],
        'boss'
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors).toContain('counselorNotAvailable')
      expect(written).toBe(0)
    })

    it('refuses an id belonging to nobody', async () => {
      const { result, written } = await submitWith([activeCounselor], 'made-up-id')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors).toContain('counselorNotAvailable')
      expect(written).toBe(0)
    })
  })

  it('rejects a counselorId that does not match any active counselor', async () => {
    const visitRepository = createFakeVisitRepository()
    const userRepository = createFakeUserRepository([activeCounselor])
    const result = await submitFollowUpVisit(
      {
        name: 'Demo Student One',
        phone: '56012345',
        counselorId: 'not-a-real-counselor-id',
        createdBy: 'staff-1',
      },
      { visitRepository, userRepository, clock: createFixedClock(NOW) }
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('counselorNotAvailable')

    const visits = await visitRepository.findMostRecentByPhone('56012345')
    expect(visits).toBeNull()
  })

  it('blocks a second submission from the same phone while an earlier visit is still open and recent', async () => {
    const visitRepository = createFakeVisitRepository()
    await visitRepository.create({
      type: 'new',
      name: 'Fictional Student I',
      phone: '56012345',
      desiredCountry: 'USA',
      counselorId: 'demoCounselorOne',
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })
    const userRepository = createFakeUserRepository([activeCounselor])

    const result = await submitFollowUpVisit(
      {
        name: 'Fictional Student I',
        phone: '56012345',
        counselorId: 'demoCounselorOne',
        createdBy: 'staff-1',
      },
      { visitRepository, userRepository, clock: createFixedClock(new Date()) }
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('duplicateVisitPending')
  })

  it('allows the second submission through when overrideDuplicate is set', async () => {
    const visitRepository = createFakeVisitRepository()
    await visitRepository.create({
      type: 'new',
      name: 'Fictional Student I',
      phone: '56012345',
      desiredCountry: 'USA',
      counselorId: 'demoCounselorOne',
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })
    const userRepository = createFakeUserRepository([activeCounselor])

    const result = await submitFollowUpVisit(
      {
        name: 'Fictional Student I',
        phone: '56012345',
        counselorId: 'demoCounselorOne',
        createdBy: 'staff-1',
        overrideDuplicate: true,
      },
      { visitRepository, userRepository, clock: createFixedClock(new Date()) }
    )
    expect(result.ok).toBe(true)
  })
})

describe('submitFollowUpVisit came-to', () => {
  it('records the counselor the client chose as who they came to', async () => {
    const visitRepository = createFakeVisitRepository([priorVisit])
    const userRepository = createFakeUserRepository([activeCounselor])
    const result = await submitFollowUpVisit(
      {
        name: 'Demo Student One',
        phone: '56012345',
        counselorId: 'demoCounselorOne',
        createdBy: null,
      },
      { visitRepository, userRepository, clock: createFixedClock(NOW) }
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.requestedCounselorId).toBe('demoCounselorOne')
      expect(result.visit.assignedAt).toBeInstanceOf(Date)
    }
  })
})
