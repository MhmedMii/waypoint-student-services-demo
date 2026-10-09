import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// الحارس نفسه مختبر لحاله. اللي هنا شي ثاني: إن كل مسار عام *ينادي* الحارس
// ويحترم جوابه. بدون هذا، أحد يحذف سطر الحارس من المسار وكل التستات تعدي
const holder = vi.hoisted(() => ({
  ipTooMany: false,
  phoneTooMany: false,
  visits: null as any,
  users: null as any,
  applications: null as any,
  documents: null as any,
  specializations: null as any,
  logged: [] as any[],
}))

vi.mock('../../infrastructure/rateLimit/guardPublicSubmission', () => ({
  guardPublicSubmission: async () => ({ tooMany: holder.ipTooMany }),
  guardRepeatSubmitter: async () => ({ tooMany: holder.phoneTooMany }),
}))
vi.mock('../../infrastructure/db/pool', () => ({ pool: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }))
vi.mock('../../infrastructure/auth/authOptions', () => ({ authOptions: {} }))
vi.mock('../../adapters/repositories/postgresVisitRepository', () => ({
  createPostgresVisitRepository: () => holder.visits,
}))
vi.mock('../../adapters/repositories/postgresUserRepository', () => ({
  createPostgresUserRepository: () => holder.users,
}))
vi.mock('../../adapters/repositories/postgresApplicationRepository', () => ({
  createPostgresApplicationRepository: () => holder.applications,
}))
vi.mock('../../adapters/repositories/postgresApplicationDocumentRepository', () => ({
  createPostgresApplicationDocumentRepository: () => holder.documents,
}))
vi.mock('../../adapters/repositories/postgresSpecializationRepository', () => ({
  createPostgresSpecializationRepository: () => holder.specializations,
}))
vi.mock('../../infrastructure/activity/logActivity', () => ({
  logActivity: async (...args: any[]) => {
    holder.logged.push(args.slice(2))
  },
}))

import {
  createFakeVisitRepository,
  createFakeUserRepository,
  createFakeApplicationRepository,
  createFakeApplicationDocumentRepository,
  createFakeSpecializationRepository,
} from '../../application/testing/fakes'
import type { User } from '../../domain/entities/user'
import { translateErrorCode } from '../../i18n/translateErrorCode'
import { POST as postNewVisit } from './visits/new/route'
import { POST as postFollowUp } from './visits/follow-up/route'
import { POST as postVisaVisit } from './visits/visa/route'
import { POST as postApplication } from './applications/route'

const TOO_MANY = 429

function body(extra: Record<string, unknown> = {}) {
  return JSON.stringify({ name: 'Sample Client', phone: '50000001', ...extra })
}

function request(payload: string) {
  return new NextRequest('http://localhost/api/public', { method: 'POST', body: payload })
}

const ROUTES = [
  {
    name: '/api/visits/new',
    call: () => postNewVisit(request(body({ desiredCountry: 'USA' }))),
  },
  {
    name: '/api/visits/follow-up',
    call: () => postFollowUp(request(body({ counselorId: 'demoCounselorOne' }))),
  },
  { name: '/api/visits/visa', call: () => postVisaVisit(request(body())) },
  {
    name: '/api/applications',
    call: () =>
      postApplication(request(body({ kind: 'visa', serviceCode: 'uk-student', fields: {} }))),
  },
]

beforeEach(() => {
  holder.ipTooMany = false
  holder.phoneTooMany = false
  holder.logged.length = 0
  holder.visits = createFakeVisitRepository()
  holder.users = createFakeUserRepository([])
  holder.applications = createFakeApplicationRepository()
  holder.documents = createFakeApplicationDocumentRepository()
  holder.specializations = createFakeSpecializationRepository([])
})

describe.each(ROUTES)('$name refuses a flood', ({ call }) => {
  it('answers 429 when the device has submitted too often', async () => {
    holder.ipTooMany = true
    expect((await call()).status).toBe(TOO_MANY)
  })

  it('answers 429 when the same number has submitted too often', async () => {
    holder.phoneTooMany = true
    expect((await call()).status).toBe(TOO_MANY)
  })

  // ٤٢٩ ما ينفع لحاله: لو المسار رجّع ٤٢٩ وكتب الصف برضه، الحظر مجرد ديكور
  it('writes nothing at all when it refuses', async () => {
    holder.ipTooMany = true
    await call()
    expect(await holder.visits.countAll()).toBe(0)
    expect(holder.logged).toEqual([])
  })

  it('still lets an ordinary submission through', async () => {
    const response = await call()
    expect(response.status).not.toBe(TOO_MANY)
  })

  // الرسالة تذكر مدة انتظار، فلازم كل فرع يرجّع رمز المحدّد اللي فعلاً حظر —
  // الجهاز ١٠ دقايق والرقم ١٥. رمز غلط = رقم غلط قدّام الزائر
  it('names the device limit when the device limit fired', async () => {
    holder.ipTooMany = true
    expect((await (await call()).json()).errors).toEqual(['tooManySubmissions'])
  })

  it('names the phone-number limit when the phone-number limit fired', async () => {
    holder.phoneTooMany = true
    expect((await (await call()).json()).errors).toEqual(['tooManySubmissionsFromNumber'])
  })

  it('names the device limit when both would fire, since it is checked first', async () => {
    holder.ipTooMany = true
    holder.phoneTooMany = true
    expect((await (await call()).json()).errors).toEqual(['tooManySubmissions'])
  })

  // جملة إنجليزية ما تنترجم وتطلع كما هي على الشاشة العربية. رمز بلا نص بأي لغة = نفس المشكلة
  it('sends only codes the app can show in English and in Arabic', async () => {
    for (const flag of ['ipTooMany', 'phoneTooMany'] as const) {
      holder.ipTooMany = flag === 'ipTooMany'
      holder.phoneTooMany = flag === 'phoneTooMany'
      const { errors } = await (await call()).json()
      for (const code of errors) {
        expect(translateErrorCode('en', code)).not.toBeNull()
        expect(translateErrorCode('ar', code)).not.toBeNull()
      }
    }
  })
})
// أخطر حالة بالسجل: عميل وصل وراح بدون مستشار. كانت مدفونة كنص رمادي بآخر
// سطر "إنشاء زيارة"، والحين لها صف أحمر مستقل
describe('an absent counselor still receives the client, flagged red', () => {
  const actions = () => holder.logged.map((entry) => entry[0])

  it('assigns to the absent counselor and flags it, rather than leaving nobody', async () => {
    // نفس الشخص لازم يكون بالمستودعين — الاسم يجي من جدول المستخدمين
    holder.users = createFakeUserRepository([
      {
        id: 'demoCounselorOne',
        name: 'Demo Counselor One',
        nameAr: 'مستشار تجريبي أول',
        role: 'counselor',
        email: 'demoCounselorOne@example.com',
        passwordHash: 'x',
        active: true,
        scopes: [],
        shift: null,
        lastSeenAt: new Date('2026-01-05T09:00:00Z'),
      } as unknown as User,
    ])
    holder.specializations = createFakeSpecializationRepository([
      {
        id: 'demoCounselorOne',
        scopes: ['USA'],
        lastAssignedAt: null,
        shift: null,
        lastSeenAt: new Date('2026-01-05T09:00:00Z'),
      },
    ])

    const response = await postNewVisit(request(body({ desiredCountry: 'USA' })))
    expect(response.status).toBe(200)
    expect(actions()).toEqual(['visit_created', 'visit_assigned_to_absent'])

    const [, , , details] = holder.logged[1]
    expect(details).toContain('Sample Client went to')
  })

  // ما فيه أحد بهالتخصص أصلاً غير "فيه واحد بس غايب" — الأول مو تنبيه غياب
  // الحالة الوحيدة اللي يبقى فيها العميل بلا مستشار
  it('writes the unassigned row when nobody covers that country at all', async () => {
    const response = await postNewVisit(request(body({ desiredCountry: 'USA' })))
    expect(response.status).toBe(200)
    expect(actions()).toEqual(['visit_created', 'visit_left_unassigned'])
  })

  it('stays quiet when the counselor on shift has been in', async () => {
    holder.specializations = createFakeSpecializationRepository([
      {
        id: 'demoCounselorOne',
        scopes: ['USA'],
        lastAssignedAt: null,
        shift: null,
        lastSeenAt: new Date(),
      },
    ])

    const response = await postNewVisit(request(body({ desiredCountry: 'USA' })))
    expect(response.status).toBe(200)
    expect(actions()).toEqual(['visit_created'])
  })
})
