import type { Visit, VisitType } from '../../domain/entities/visit'
import type { Application } from '../../domain/entities/application'
import { COUNTRY_SCOPES } from '../../domain/entities/counselor'
import { computeVisitTurnaround } from '../../domain/time/computeVisitTurnaround'
import { computeHandlingStats } from '../../domain/time/computeHandlingStats'
import { followUpDueStatus } from '../../domain/time/followUpDueStatus'
import type { VisitRepository } from '../ports/VisitRepository'
import type { UserRepository } from '../ports/UserRepository'
import type { ApplicationRepository } from '../ports/ApplicationRepository'
import { UNASSIGNED_COUNSELOR_ID } from '../../domain/routing/unassignedCounselor'

export interface GetAdminKpisDeps {
  visitRepository: VisitRepository
  userRepository: UserRepository
  applicationRepository: ApplicationRepository
}

export interface AdminKpis {
  totalByType: Record<VisitType, number>
  countryBreakdown: Array<{ country: string; count: number }>
  funnel: { next: number; closed: number }
  counselorPerformance: Array<{
    counselorId: string
    counselorName: string
    counselorNameAr: string | null
    // المستشار المعطّل يظل بالجدول لأن زياراته السابقة جزء من الأرقام — بس
    // الشاشة لازم تفرّقه عن الشغّال، وما تعرض له زر إعادة تعيين
    active: boolean
    lastSeenAt: Date | null
    visitCount: number
    closedCount: number
    avgHandlingMs: number | null
    instantCloseCount: number
    instantCloseAvgMs: number | null
    leftOpenCount: number
    leftOpenAvgMs: number | null
    applicationCount: number
  }>
  turnaround: { within24h: number; over24h: number; inProgress: number }
  // مو محسوبة على نطاق التواريخ المختار بالداشبورد عمدًا — متابعة معلّقة من
  // أسابيع تظل مهمة، والعدّاد هذا لازم يعكس كل شي معلّق حاليًا مهما كان تاريخه
  followUpsDue: { total: number; overdue: number }
}

function tallyByType(visits: Visit[]): Record<VisitType, number> {
  return {
    new: visits.filter((v) => v.type === 'new').length,
    follow_up: visits.filter((v) => v.type === 'follow_up').length,
    visa: visits.filter((v) => v.type === 'visa').length,
  }
}

function tallyCountryBreakdown(visits: Visit[]): Array<{ country: string; count: number }> {
  const counts = new Map<string, number>(COUNTRY_SCOPES.map((country) => [country, 0]))
  for (const v of visits) {
    if (!v.desiredCountry) continue
    counts.set(v.desiredCountry, (counts.get(v.desiredCountry) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([country, count]) => ({ country, count }))
}

function tallyFunnel(visits: Visit[]): { next: number; closed: number } {
  return {
    next: visits.filter((v) => v.status === 'next').length,
    closed: visits.filter((v) => v.status === 'closed').length,
  }
}

function performanceFor(
  counselorId: string,
  counselorName: string,
  counselorNameAr: string | null,
  active: boolean,
  lastSeenAt: Date | null,
  visits: Visit[],
  applications: Application[]
): AdminKpis['counselorPerformance'][number] {
  const own = visits.filter((v) => v.counselorId === counselorId)
  const {
    closedCount,
    avgHandlingMs,
    instantCloseCount,
    instantCloseAvgMs,
    leftOpenCount,
    leftOpenAvgMs,
  } = computeHandlingStats(own)
  return {
    counselorId,
    counselorName,
    counselorNameAr,
    active,
    lastSeenAt,
    visitCount: own.length,
    closedCount,
    avgHandlingMs,
    instantCloseCount,
    instantCloseAvgMs,
    leftOpenCount,
    leftOpenAvgMs,
    applicationCount: applications.filter((a) => a.counselorId === counselorId).length,
  }
}

async function tallyCounselorPerformance(
  visits: Visit[],
  applications: Application[],
  deps: GetAdminKpisDeps
): Promise<AdminKpis['counselorPerformance']> {
  const activeCounselors = await deps.userRepository.findActiveCounselors()
  // نجيب الكل مو بس النشطين: المستشار المعطّل يظل له زيارات بالفترة، ولو ما
  // عرفنا اسمه بيطلع رقمه الداخلي بالجدول بدل اسمه
  const everyone = await deps.userRepository.findAll()
  const nameById = new Map(everyone.map((u) => [u.id, u.name]))
  const nameArById = new Map(everyone.map((u) => [u.id, u.nameAr]))
  const activeById = new Map(everyone.map((u) => [u.id, u.active]))
  const lastSeenAtById = new Map(everyone.map((u) => [u.id, u.lastSeenAt]))
  const rosterIds = new Set(activeCounselors.map((c) => c.id))
  const extraIds = [
    ...new Set(
      [...visits.map((v) => v.counselorId), ...applications.map((a) => a.counselorId)].filter(
        (id): id is string => id !== null && !rosterIds.has(id)
      )
    ),
  ].sort((a, b) => a.localeCompare(b))

  const orderedIds = [
    ...[...activeCounselors].sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.id),
    ...extraIds,
  ]
  const rows = orderedIds.map((counselorId) =>
    performanceFor(
      counselorId,
      nameById.get(counselorId) ?? counselorId,
      nameArById.get(counselorId) ?? null,
      activeById.get(counselorId) ?? false,
      lastSeenAtById.get(counselorId) ?? null,
      visits,
      applications
    )
  )

  const unassignedVisits = visits.filter((v) => v.counselorId === null)
  const unassignedApplications = applications.filter((a) => a.counselorId === null)
  if (unassignedVisits.length > 0 || unassignedApplications.length > 0) {
    const {
      closedCount,
      avgHandlingMs,
      instantCloseCount,
      instantCloseAvgMs,
      leftOpenCount,
      leftOpenAvgMs,
    } = computeHandlingStats(unassignedVisits)
    rows.push({
      counselorId: UNASSIGNED_COUNSELOR_ID,
      counselorName: '',
      counselorNameAr: null,
      // صف "غير معيّن" مو شخص أصلاً، فما ينعرض كمعطّل ولا غائب
      active: true,
      lastSeenAt: null,
      visitCount: unassignedVisits.length,
      closedCount,
      avgHandlingMs,
      instantCloseCount,
      instantCloseAvgMs,
      leftOpenCount,
      leftOpenAvgMs,
      applicationCount: unassignedApplications.length,
    })
  }

  return rows
}

// نستخدم نفس لائحة الزيارات المستخدمة لعدد "المغلقة" (funnel.closed) عشان
// البطاقات الثلاث تطابقها دايمًا، بدل ما تحسب من لائحة طلبات فيزا منفصلة تمامًا
function tallyTurnaround(visits: Visit[]): AdminKpis['turnaround'] {
  const now = new Date()
  return visits.reduce(
    (acc, visit) => {
      const turnaround = computeVisitTurnaround(visit, now)
      if (turnaround.status === 'within24h') acc.within24h += 1
      else if (turnaround.status === 'over24h') acc.over24h += 1
      else acc.inProgress += 1
      return acc
    },
    { within24h: 0, over24h: 0, inProgress: 0 }
  )
}

async function tallyFollowUpsDue(
  visitRepository: VisitRepository
): Promise<AdminKpis['followUpsDue']> {
  const pending = await visitRepository.findAllByStudentStatus('follow_up_needed')
  const now = new Date()
  const overdue = pending.filter(
    (v) => v.followUpDueAt && followUpDueStatus(v.followUpDueAt, now).kind === 'overdue'
  ).length
  return { total: pending.length, overdue }
}

export async function getAdminKpis(
  range: { from: Date; to: Date },
  deps: GetAdminKpisDeps
): Promise<AdminKpis> {
  const visits = await deps.visitRepository.findAllInRange(range.from, range.to)
  const applications = await deps.applicationRepository.findAllInRange(range.from, range.to)
  return {
    totalByType: tallyByType(visits),
    countryBreakdown: tallyCountryBreakdown(visits),
    funnel: tallyFunnel(visits),
    counselorPerformance: await tallyCounselorPerformance(visits, applications, deps),
    turnaround: tallyTurnaround(visits),
    followUpsDue: await tallyFollowUpsDue(deps.visitRepository),
  }
}
