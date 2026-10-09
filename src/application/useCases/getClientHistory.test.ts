import { describe, it, expect } from 'vitest'
import { getClientHistory, getClientHistoriesByPhone } from './getClientHistory'
import {
  createFakeVisitRepository,
  createFakeApplicationRepository,
  createFakeUserRepository,
} from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'
import type { Application } from '../../domain/entities/application'
import type { User } from '../../domain/entities/user'

const counselor: User = {
  id: 'counselor-1',
  name: 'Demo Counselor Six',
  nameAr: 'مستشار تجريبي سادس',
  role: 'counselor',
  email: 'ali@example.com',
  passwordHash: 'x',
  active: false,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

const seedVisits: Visit[] = [
  {
    id: 'visit-1',
    type: 'new',
    name: 'Demo Student One',
    phone: '56012345',
    desiredCountry: 'GCC',
    counselorId: 'counselor-1',
    linkedVisitId: null,
    status: 'closed',
    studentStatus: 'closed',
    pickedUpAt: null,
    closedAt: null,
    followUpDueAt: null,
    createdBy: null,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date(),
  },
  {
    id: 'visit-2',
    type: 'new',
    name: 'Demo Student One',
    phone: '56012345',
    desiredCountry: 'GCC',
    counselorId: 'counselor-1',
    linkedVisitId: null,
    status: 'next',
    studentStatus: 'waiting',
    pickedUpAt: null,
    closedAt: null,
    followUpDueAt: null,
    createdBy: null,
    createdAt: new Date('2026-08-10T10:00:00Z'),
    updatedAt: new Date(),
  },
]

const ADMIN = { role: 'admin' as const, id: 'admin-1', scopes: [] }
// counselor-1 تولّى الزيارتين بالـ seed
const OWN_COUNSELOR = { role: 'counselor' as const, id: 'counselor-1', scopes: [] }
const OTHER_COUNSELOR = { role: 'counselor' as const, id: 'counselor-2', scopes: [] }

function makeDeps() {
  return {
    visitRepository: createFakeVisitRepository(seedVisits),
    applicationRepository: createFakeApplicationRepository(),
    userRepository: createFakeUserRepository([counselor]),
  }
}

describe('getClientHistory', () => {
  it('returns entries for a phone sorted newest first, resolving a name even for an inactive counselor', async () => {
    const result = await getClientHistory(ADMIN, '56012345', makeDeps())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.entries).toHaveLength(2)
      expect(result.entries[0].id).toBe('visit-2')
      expect(result.entries[0].counselorName).toBe('Demo Counselor Six')
      expect(result.entries[0].counselorNameAr).toBe('مستشار تجريبي سادس')
      expect(result.entries[0].visitType).toBe('new')
      expect(result.entries[0].applicationKind).toBeNull()
    }
  })

  // القديم كان يفحص فرعاً ميتاً: UserRole أصلاً ثلاثة أدوار فقط، فالشرط
  // ما ينطبق أبداً. كان يقرأ كتحقق صلاحيات وهو ما يحقق شي
  it('lets a counselor see a client they have handled', async () => {
    const result = await getClientHistory(OWN_COUNSELOR, '56012345', makeDeps())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.entries).toHaveLength(2)
  })

  // الأرقام الكويتية ثمان خانات — قابلة للعد كلها لو تركنا الباب مفتوح
  it('refuses a counselor a client they have never handled', async () => {
    const result = await getClientHistory(OTHER_COUNSELOR, '56012345', makeDeps())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('notYourClient')
  })

  it('tells an admin everything without asking who handled it', async () => {
    const result = await getClientHistory(ADMIN, '56012345', makeDeps())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.entries.every((e) => !e.redacted)).toBe(true)
  })
})

describe('getClientHistory — what a counselor may read of it', () => {
  const visaApplication = {
    id: 'app-1',
    kind: 'visa' as const,
    applicationNumber: 'V-1',
    serviceCode: 'schengen_visit',
    name: 'Demo Student One',
    phone: '56012345',
    status: 'submitted',
    counselorId: 'counselor-9',
    fields: {},
    paymentUrl: null,
    createdAt: new Date('2026-08-05T10:00:00Z'),
    updatedAt: new Date(),
    closedAt: null,
    acceptedAt: null,
  } as unknown as Application

  function depsWithVisaApplication() {
    return {
      visitRepository: createFakeVisitRepository(seedVisits),
      applicationRepository: createFakeApplicationRepository([visaApplication]),
      userRepository: createFakeUserRepository([counselor]),
    }
  }

  const examCounselor = { ...OWN_COUNSELOR, scopes: ['exam_services' as const] }

  it('redacts an application outside the counselor scope, keeping only its date', async () => {
    const result = await getClientHistory(examCounselor, '56012345', depsWithVisaApplication())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const hidden = result.entries.find((e) => e.id === 'app-1')
    expect(hidden?.redacted).toBe(true)
    expect(hidden?.applicationKind).toBeNull()
    expect(hidden?.serviceCode).toBeNull()
    expect(hidden?.status).toBe('')
    expect(hidden?.counselorName).toBeNull()
    // التاريخ يبقى: هو اللي يخلي العدد بالشارة يوافق اللي ينعرض
    expect(hidden?.createdAt).toEqual(new Date('2026-08-05T10:00:00Z'))
  })

  it('still lists the redacted row, so the count and the list agree', async () => {
    const result = await getClientHistory(examCounselor, '56012345', depsWithVisaApplication())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.entries).toHaveLength(3)
  })

  it('shows an application inside the counselor scope in full', async () => {
    const visaCounselor = { ...OWN_COUNSELOR, scopes: ['visa_services' as const] }
    const result = await getClientHistory(visaCounselor, '56012345', depsWithVisaApplication())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const shown = result.entries.find((e) => e.id === 'app-1')
    expect(shown?.redacted).toBe(false)
    expect(shown?.serviceCode).toBe('schengen_visit')
  })

  // شغله هو: ما نحجب عنه اللي سوّاه بنفسه مهما كان نطاقه اليوم
  it('never hides a row the counselor handled themselves', async () => {
    const theirs = { ...visaApplication, counselorId: 'counselor-1' } as Application
    const result = await getClientHistory(examCounselor, '56012345', {
      visitRepository: createFakeVisitRepository(seedVisits),
      applicationRepository: createFakeApplicationRepository([theirs]),
      userRepository: createFakeUserRepository([counselor]),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entries.find((e) => e.id === 'app-1')?.redacted).toBe(false)
  })

  it('never redacts anything for an admin', async () => {
    const result = await getClientHistory(ADMIN, '56012345', depsWithVisaApplication())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.entries.every((e) => !e.redacted)).toBe(true)
  })
})
describe('getClientHistoriesByPhone — the whole export in a fixed number of queries', () => {
  function countingDeps(phones: string[]) {
    const visitRepository = createFakeVisitRepository(seedVisits)
    const applicationRepository = createFakeApplicationRepository()
    const userRepository = createFakeUserRepository([counselor])
    const calls = { visits: 0, applications: 0, users: 0 }

    return {
      calls,
      phones,
      deps: {
        visitRepository: {
          ...visitRepository,
          findAllByPhones: async (p: string[]) => {
            calls.visits += 1
            return visitRepository.findAllByPhones(p)
          },
        },
        applicationRepository: {
          ...applicationRepository,
          findAllByPhones: async (p: string[]) => {
            calls.applications += 1
            return applicationRepository.findAllByPhones(p)
          },
        },
        userRepository: {
          ...userRepository,
          findAll: async () => {
            calls.users += 1
            return userRepository.findAll()
          },
        },
      },
    }
  }

  // البق: كل عميل كان يكلّف ثلاثة استعلامات، وواحد منها findAll() على جدول
  // المستخدمين كامل. مية عميل = ٣٠٠ استعلام على Pool فيه عشرة اتصالات
  it('asks the database the same number of times for one client or a hundred', async () => {
    const one = countingDeps(['56012345'])
    await getClientHistoriesByPhone(ADMIN, one.phones, one.deps)
    expect(one.calls).toEqual({ visits: 1, applications: 1, users: 1 })

    const many = countingDeps(Array.from({ length: 100 }, (_, i) => `5601${2000 + i}`))
    await getClientHistoriesByPhone(ADMIN, many.phones, many.deps)
    expect(many.calls).toEqual({ visits: 1, applications: 1, users: 1 })
  })

  it('reads the users table once, not once per client', async () => {
    const many = countingDeps(['56012345', '56012346', '56012347'])
    await getClientHistoriesByPhone(ADMIN, many.phones, many.deps)
    expect(many.calls.users).toBe(1)
  })

  it('asks nothing at all when there are no clients to export', async () => {
    const none = countingDeps([])
    const result = await getClientHistoriesByPhone(ADMIN, none.phones, none.deps)
    expect(none.calls).toEqual({ visits: 0, applications: 0, users: 0 })
    expect(result.size).toBe(0)
  })

  it('groups each client onto their own phone, newest first', async () => {
    const result = await getClientHistoriesByPhone(ADMIN, ['56012345'], makeDeps())
    const entries = result.get('56012345') ?? []
    expect(entries).toHaveLength(2)
    expect(entries[0].id).toBe('visit-2')
  })

  it('gives a phone with no history an empty list rather than nothing', async () => {
    const result = await getClientHistoriesByPhone(ADMIN, ['59999999'], makeDeps())
    expect(result.get('59999999')).toEqual([])
  })

  // نفس قواعد النسخة المفردة: ما ينفع التصدير يقول غير ما تقوله الشاشة
  it('applies the same counselor rules as the single-client version', async () => {
    const mine = await getClientHistoriesByPhone(OWN_COUNSELOR, ['56012345'], makeDeps())
    expect(mine.get('56012345')).toHaveLength(2)

    const theirs = await getClientHistoriesByPhone(OTHER_COUNSELOR, ['56012345'], makeDeps())
    expect(theirs.get('56012345')).toEqual([])
  })

  it('does not ask twice for a phone that appears twice', async () => {
    const dup = countingDeps(['56012345', '56012345'])
    await getClientHistoriesByPhone(ADMIN, dup.phones, dup.deps)
    expect(dup.calls).toEqual({ visits: 1, applications: 1, users: 1 })
  })
})
