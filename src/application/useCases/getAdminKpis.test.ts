import { describe, it, expect } from 'vitest'
import { getAdminKpis } from './getAdminKpis'
import { UNASSIGNED_COUNSELOR_ID } from '../../domain/routing/unassignedCounselor'
import {
  createFakeVisitRepository,
  createFakeUserRepository,
  createFakeApplicationRepository,
} from '../testing/fakes'
import type { Visit } from '../../domain/entities/visit'
import type { User } from '../../domain/entities/user'
import type { Application } from '../../domain/entities/application'

function visit(overrides: Partial<Visit>): Visit {
  return {
    id: 'v',
    type: 'new',
    name: 'Client',
    phone: '56012345',
    desiredCountry: 'US',
    counselorId: 'demoCounselorOne',
    linkedVisitId: null,
    status: 'next',
    studentStatus: 'waiting',
    pickedUpAt: null,
    closedAt: null,
    followUpDueAt: null,
    createdBy: 'staff',
    createdAt: new Date('2026-08-12T09:00:00Z'),
    updatedAt: new Date('2026-08-12T09:00:00Z'),
    ...overrides,
  }
}

function counselor(overrides: Partial<User>): User {
  return {
    id: 'demoCounselorOne',
    name: 'DemoCounselorOne',
    role: 'counselor',
    email: 'demoCounselorOne@example.com',
    passwordHash: 'x',
    active: true,
    lastSeenAt: null,
    onlineSecondsToday: 0,
    onlineDay: null,
    shift: null,
    floor: null,
    ...overrides,
  }
}

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
    createdAt: new Date('2026-08-12T09:00:00Z'),
    updatedAt: new Date('2026-08-12T09:00:00Z'),
    ...overrides,
  }
}

describe('getAdminKpis', () => {
  it('aggregates volume by type, country breakdown, funnel, and per-counselor performance', async () => {
    const visits = [
      visit({
        id: 'v1',
        type: 'new',
        desiredCountry: 'US',
        counselorId: 'demoCounselorOne',
        status: 'closed',
        pickedUpAt: new Date('2026-08-12T09:00:00Z'),
        closedAt: new Date('2026-08-12T09:20:00Z'),
      }),
      visit({
        id: 'v2',
        type: 'new',
        desiredCountry: 'UK',
        counselorId: 'demoCounselorSeven',
        status: 'next',
      }),
      visit({
        id: 'v3',
        type: 'follow_up',
        desiredCountry: null,
        counselorId: 'demoCounselorOne',
        status: 'closed',
        pickedUpAt: new Date('2026-08-12T10:00:00Z'),
        closedAt: new Date('2026-08-12T10:10:00Z'),
      }),
    ]
    const visitRepository = createFakeVisitRepository(visits)
    const userRepository = createFakeUserRepository([
      counselor({ id: 'demoCounselorOne', name: 'DemoCounselorOne' }),
      counselor({ id: 'demoCounselorSeven', name: 'Demo Counselor D' }),
    ])
    const range = { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') }

    const applicationRepository = createFakeApplicationRepository([])
    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    expect(kpis.totalByType.new).toBe(2)
    expect(kpis.totalByType.follow_up).toBe(1)
    expect(kpis.countryBreakdown).toEqual(
      expect.arrayContaining([
        { country: 'US', count: 1 },
        { country: 'UK', count: 1 },
      ])
    )
    expect(kpis.funnel).toEqual({ next: 1, closed: 2 })

    const demoCounselorOnePerf = kpis.counselorPerformance.find(
      (c) => c.counselorId === 'demoCounselorOne'
    )
    expect(demoCounselorOnePerf?.visitCount).toBe(2)
    expect(demoCounselorOnePerf?.closedCount).toBe(2)
    expect(demoCounselorOnePerf?.avgHandlingMs).toBe(900000)
  })

  // كان يطلع رقم المستشار الداخلي بدل اسمه بمجرد ما ينعطّل، لأن البحث عن
  // الأسماء كان بالنشطين بس
  it('keeps naming a counselor after they are deactivated, and marks them', async () => {
    const visits = [
      visit({
        id: 'v1',
        counselorId: 'gone',
        createdAt: new Date('2026-08-12T09:00:00Z'),
        status: 'closed',
        pickedUpAt: new Date('2026-08-12T09:00:00Z'),
        closedAt: new Date('2026-08-12T09:20:00Z'),
      }),
    ]
    const userRepository = createFakeUserRepository([
      counselor({ id: 'here', name: 'Still Here' }),
      counselor({ id: 'gone', name: 'Left The Company', active: false }),
    ])

    const kpis = await getAdminKpis(
      { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') },
      {
        visitRepository: createFakeVisitRepository(visits),
        userRepository,
        applicationRepository: createFakeApplicationRepository([]),
      }
    )

    const left = kpis.counselorPerformance.find((c) => c.counselorId === 'gone')
    expect(left?.counselorName).toBe('Left The Company')
    expect(left?.active).toBe(false)
    expect(left?.visitCount).toBe(1)

    const stayed = kpis.counselorPerformance.find((c) => c.counselorId === 'here')
    expect(stayed?.active).toBe(true)
  })

  it('includes an active counselor with zero visits in range', async () => {
    const visitRepository = createFakeVisitRepository([])
    const userRepository = createFakeUserRepository([
      counselor({ id: 'idle', name: 'Idle Counselor' }),
    ])
    const range = { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') }

    const applicationRepository = createFakeApplicationRepository([])
    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    expect(kpis.counselorPerformance).toEqual([
      {
        counselorId: 'idle',
        counselorName: 'Idle Counselor',
        counselorNameAr: null,
        active: true,
        lastSeenAt: null,
        visitCount: 0,
        closedCount: 0,
        avgHandlingMs: null,
        instantCloseCount: 0,
        instantCloseAvgMs: null,
        leftOpenCount: 0,
        leftOpenAvgMs: null,
        applicationCount: 0,
      },
    ])
  })

  it('carries the counselor’s lastSeenAt through to their KPI row', async () => {
    const lastSeenAt = new Date('2026-09-01T09:00:00.000Z')
    const visitRepository = createFakeVisitRepository([])
    const userRepository = createFakeUserRepository([
      counselor({ id: 'demoCounselorOne', name: 'Demo Counselor One', lastSeenAt }),
    ])
    const range = { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') }

    const applicationRepository = createFakeApplicationRepository([])
    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    const demoCounselorOne = kpis.counselorPerformance.find(
      (c) => c.counselorId === 'demoCounselorOne'
    )
    expect(demoCounselorOne?.lastSeenAt).toEqual(lastSeenAt)
  })

  it('carries instant-close and left-open counts through to a counselor’s KPI row', async () => {
    const visits = Array.from({ length: 5 }, (_, i) =>
      visit({
        id: `demoCounselorSeven-${i}`,
        counselorId: 'demoCounselorSeven',
        createdAt: new Date('2026-09-16T08:53:00Z'),
        pickedUpAt: new Date('2026-09-16T08:53:00Z'),
        closedAt: new Date('2026-09-16T08:53:12Z'),
      })
    )
    const visitRepository = createFakeVisitRepository(visits)
    const userRepository = createFakeUserRepository([
      counselor({ id: 'demoCounselorSeven', name: 'Demo Counselor D' }),
    ])
    const range = { from: new Date('2026-09-16T00:00:00Z'), to: new Date('2026-09-17T00:00:00Z') }

    const applicationRepository = createFakeApplicationRepository([])
    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    const demoCounselorSeven = kpis.counselorPerformance.find(
      (c) => c.counselorId === 'demoCounselorSeven'
    )
    expect(demoCounselorSeven?.avgHandlingMs).toBeNull()
    expect(demoCounselorSeven?.instantCloseCount).toBe(5)
    expect(demoCounselorSeven?.instantCloseAvgMs).toBe(12000)
    expect(demoCounselorSeven?.leftOpenCount).toBe(0)
  })

  it('groups visits with no counselor into a synthetic unassigned row, pinned last', async () => {
    const visits = [
      visit({ id: 'v1', counselorId: null, status: 'next' }),
      visit({ id: 'v2', counselorId: 'zed', status: 'next' }),
    ]
    const visitRepository = createFakeVisitRepository(visits)
    const userRepository = createFakeUserRepository([counselor({ id: 'zed', name: 'Zed' })])
    const range = { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') }

    const applicationRepository = createFakeApplicationRepository([])
    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    expect(kpis.counselorPerformance.map((c) => c.counselorId)).toEqual([
      'zed',
      UNASSIGNED_COUNSELOR_ID,
    ])
    const unassigned = kpis.counselorPerformance.find(
      (c) => c.counselorId === UNASSIGNED_COUNSELOR_ID
    )
    expect(unassigned?.visitCount).toBe(1)
  })

  it('counts applications assigned to a counselor separately from visits', async () => {
    const visitRepository = createFakeVisitRepository([])
    const userRepository = createFakeUserRepository([counselor({ id: 'omar', name: 'Omar' })])
    const applicationRepository = createFakeApplicationRepository([
      application({ id: 'a1', kind: 'visa', counselorId: 'omar' }),
      application({ id: 'a2', kind: 'visa', counselorId: 'omar' }),
      application({ id: 'a3', kind: 'exam', counselorId: null }),
    ])
    const range = { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') }

    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    const omarPerf = kpis.counselorPerformance.find((c) => c.counselorId === 'omar')
    expect(omarPerf?.applicationCount).toBe(2)
    const unassigned = kpis.counselorPerformance.find(
      (c) => c.counselorId === UNASSIGNED_COUNSELOR_ID
    )
    expect(unassigned?.applicationCount).toBe(1)
  })

  it('tallies visits by 24h turnaround, using the same list "closed" counts', async () => {
    const visits = [
      visit({
        id: 'fares',
        status: 'closed',
        createdAt: new Date('2026-08-12T09:00:00Z'),
        closedAt: new Date('2026-08-12T09:24:00Z'),
      }),
      visit({
        id: 'ahmad',
        status: 'closed',
        createdAt: new Date('2026-08-12T00:00:00Z'),
        closedAt: new Date('2026-08-13T02:00:00Z'),
      }),
      visit({ id: 'muhanna', status: 'next' }),
    ]
    const visitRepository = createFakeVisitRepository(visits)
    const userRepository = createFakeUserRepository([])
    const applicationRepository = createFakeApplicationRepository([])
    const range = { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') }

    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    expect(kpis.turnaround).toEqual({ within24h: 1, over24h: 1, inProgress: 1 })
    expect(kpis.funnel.closed).toBe(2)
    expect(kpis.turnaround.within24h + kpis.turnaround.over24h).toBe(kpis.funnel.closed)
  })

  it('counts visa-type visits for totalByType.visa, not paperwork applications', async () => {
    const visits = [
      visit({ id: 'v1', type: 'new' }),
      visit({ id: 'ali', type: 'visa', counselorId: null }),
      visit({ id: 'ghadeer', type: 'visa', counselorId: null }),
    ]
    const visitRepository = createFakeVisitRepository(visits)
    const userRepository = createFakeUserRepository([])
    // طلبات فيزا (Applications) ما لها أي علاقة بعد اليوم بهذا العدّاد —
    // نتأكد إنها ما تدخل الحساب ولا تخفي غياب زيارات الفيزا الحقيقية
    const applicationRepository = createFakeApplicationRepository([application({ id: 'a1' })])
    const range = { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') }

    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    expect(kpis.totalByType.visa).toBe(2)
  })

  it('adds up to the same total the counselor performance table shows, unassigned visits included', async () => {
    const visits = [
      visit({ id: 'n1', type: 'new', counselorId: null }),
      visit({ id: 'f1', type: 'follow_up', counselorId: null }),
      visit({ id: 'ali', type: 'visa', counselorId: null }),
      visit({ id: 'ghadeer', type: 'visa', counselorId: null }),
    ]
    const visitRepository = createFakeVisitRepository(visits)
    const userRepository = createFakeUserRepository([])
    const applicationRepository = createFakeApplicationRepository([])
    const range = { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') }

    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    const counselorTableTotal = kpis.counselorPerformance.reduce((sum, c) => sum + c.visitCount, 0)
    const topCardsTotal = kpis.totalByType.new + kpis.totalByType.follow_up + kpis.totalByType.visa
    expect(topCardsTotal).toBe(counselorTableTotal)
    expect(topCardsTotal).toBe(4)
  })

  it('counts pending follow-ups regardless of the selected date range', async () => {
    const visits = [
      // خارج نطاق التقرير المختار — بس المتابعة المعلّقة تبقى تُحسب لأنها مو مرتبطة بمدى تواريخ
      visit({
        id: 'old',
        studentStatus: 'follow_up_needed',
        status: 'closed',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        followUpDueAt: new Date('2020-01-01T00:00:00Z'),
      }),
      visit({
        id: 'in-range-due-later',
        studentStatus: 'follow_up_needed',
        status: 'closed',
        followUpDueAt: new Date('2030-01-01T00:00:00Z'),
      }),
      visit({ id: 'not-pending', studentStatus: 'closed', status: 'closed' }),
    ]
    const visitRepository = createFakeVisitRepository(visits)
    const userRepository = createFakeUserRepository([])
    const applicationRepository = createFakeApplicationRepository([])
    const range = { from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') }

    const kpis = await getAdminKpis(range, {
      visitRepository,
      userRepository,
      applicationRepository,
    })

    expect(kpis.followUpsDue.total).toBe(2)
    expect(kpis.followUpsDue.overdue).toBe(1)
  })
})
