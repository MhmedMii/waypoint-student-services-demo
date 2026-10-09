import { describe, it, expect } from 'vitest'
import { scopeForApplicationKind, holdsScopeForApplicationKind } from './applicationScope'
import { assignApplicationCounselor } from '../../application/useCases/assignApplicationCounselor'
import { updateApplicationStatus } from '../../application/useCases/updateApplicationStatus'
import { setApplicationPaymentUrl } from '../../application/useCases/setApplicationPaymentUrl'
import { listApplicationsForScope } from '../../application/useCases/listApplicationsForScope'
import { exportApplicationsToExcel } from '../../application/useCases/exportApplicationsToExcel'
import { getClientHistory } from '../../application/useCases/getClientHistory'
import {
  createFakeApplicationRepository,
  createFakeVisitRepository,
  createFakeUserRepository,
} from '../../application/testing/fakes'
import type { Application } from '../entities/application'
import type { SpecializationScope } from '../entities/counselor'

// نوع ثالث ما يعرفه أحد. القديم كان يعطيه exam_services بصمت
const UNKNOWN_KIND = 'passport' as never

describe('scopeForApplicationKind', () => {
  it('maps visa to visa_services', () => {
    expect(scopeForApplicationKind('visa')).toBe('visa_services')
  })

  it('maps exam to exam_services', () => {
    expect(scopeForApplicationKind('exam')).toBe('exam_services')
  })

  it('refuses an unknown kind instead of defaulting to exam_services', () => {
    expect(scopeForApplicationKind('passport')).toBeNull()
  })

  it.each([null, undefined, '', 'VISA', 42, {}])('refuses %j', (value) => {
    expect(scopeForApplicationKind(value)).toBeNull()
  })

  // "kind in obj" كان بيقبلها لأنها بسلسلة النموذج
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'refuses the prototype key %s',
    (key) => {
      expect(scopeForApplicationKind(key)).toBeNull()
    }
  )
})

describe('holdsScopeForApplicationKind', () => {
  const BOTH: SpecializationScope[] = ['visa_services', 'exam_services']

  it('is true only for the scope the kind needs', () => {
    expect(holdsScopeForApplicationKind(['visa_services'], 'visa')).toBe(true)
    expect(holdsScopeForApplicationKind(['visa_services'], 'exam')).toBe(false)
  })

  // يملك النطاقين، ومع ذلك مرفوض: هذا اللي يميّز الرفض عن الافتراض
  it('is false for an unknown kind even when both scopes are held', () => {
    expect(holdsScopeForApplicationKind(BOTH, 'passport')).toBe(false)
  })
})

// ---------- the six use cases ----------

function application(kind: Application['kind'], id = 'a1'): Application {
  return {
    id,
    applicationNumber: 'APP-0001',
    kind,
    serviceCode: 'uk-student',
    name: 'Fictional Student R',
    phone: '51234567',
    email: null,
    fields: {},
    status: 'pending',
    statusNote: null,
    referenceNumber: null,
    counselorId: 'c-visa',
    paymentUrl: null,
    acceptedAt: null,
    closedAt: null,
    createdAt: new Date('2026-09-01T09:00:00Z'),
    updatedAt: new Date('2026-09-01T09:00:00Z'),
  } as Application
}

const VISA: SpecializationScope[] = ['visa_services']
const EXAM: SpecializationScope[] = ['exam_services']
const BOTH: SpecializationScope[] = ['visa_services', 'exam_services']

// كل use case يتسأل نفس الأسئلة الخمسة. نقارن بسبب الرفض بالذات، لأن
// "مسموح" قد يفشل لاحقًا لسبب ما له علاقة بالنطاق
const CASES: Array<[string, Application['kind'], SpecializationScope[], boolean]> = [
  ['visa, held by a visa counselor', 'visa', VISA, true],
  ['visa, held only by an exam counselor', 'visa', EXAM, false],
  ['exam, held by an exam counselor', 'exam', EXAM, true],
  ['exam, held only by a visa counselor', 'exam', VISA, false],
  ['an unknown kind, even for a counselor holding both', UNKNOWN_KIND, BOTH, false],
]

type Run = (kind: Application['kind'], scopes: SpecializationScope[]) => Promise<unknown>

const USE_CASES: Record<string, Run> = {
  assignApplicationCounselor: (kind, scopes) =>
    assignApplicationCounselor('counselor', scopes, 'a1', 'c-visa', {
      applicationRepository: createFakeApplicationRepository([application(kind)]),
    }),
  updateApplicationStatus: (kind, scopes) =>
    updateApplicationStatus('counselor', scopes, 'a1', 'under_review', null, null, {
      applicationRepository: createFakeApplicationRepository([application(kind)]),
    }),
  setApplicationPaymentUrl: (kind, scopes) =>
    setApplicationPaymentUrl('counselor', scopes, 'a1', 'https://pay.example/x', {
      applicationRepository: createFakeApplicationRepository([application(kind)]),
    }),
  listApplicationsForScope: (kind, scopes) =>
    listApplicationsForScope('counselor', scopes, kind, {
      applicationRepository: createFakeApplicationRepository([application(kind)]),
    }),
  exportApplicationsToExcel: (kind, scopes) =>
    exportApplicationsToExcel('counselor', scopes, kind, [application(kind)]),
}

describe.each(Object.entries(USE_CASES))('%s', (_name, run) => {
  it.each(CASES)('%s', async (_label, kind, scopes, allowed) => {
    const result = (await run(kind, scopes)) as { ok: boolean; reason?: string }
    if (allowed) expect(result.reason).not.toBe('notAuthorizedScope')
    else expect(result).toMatchObject({ ok: false, reason: 'notAuthorizedScope' })
  })
})

// السادسة ما ترفض الطلب كامل — تحجب السطر اللي خارج النطاق
describe('getClientHistory', () => {
  async function entryFor(kind: Application['kind'], scopes: SpecializationScope[]) {
    const own = { ...application('visa', 'mine'), counselorId: 'me' }
    const other = { ...application(kind, 'theirs'), counselorId: 'someone-else' }
    const result = await getClientHistory({ role: 'counselor', id: 'me', scopes }, '51234567', {
      visitRepository: createFakeVisitRepository([]),
      applicationRepository: createFakeApplicationRepository([own, other] as Application[]),
      userRepository: createFakeUserRepository([]),
    })
    if (!result.ok) throw new Error('expected the counselor to see their own client')
    return result.entries.find((e) => e.id === 'theirs')!
  }

  it('shows a visa application to a visa counselor', async () => {
    expect((await entryFor('visa', VISA)).redacted).toBe(false)
  })

  it('redacts an exam application for a visa counselor', async () => {
    expect((await entryFor('exam', VISA)).redacted).toBe(true)
  })

  it('shows an exam application to an exam counselor', async () => {
    expect((await entryFor('exam', EXAM)).redacted).toBe(false)
  })

  it('redacts an unknown kind even for a counselor holding both scopes', async () => {
    expect((await entryFor(UNKNOWN_KIND, BOTH)).redacted).toBe(true)
  })
})
