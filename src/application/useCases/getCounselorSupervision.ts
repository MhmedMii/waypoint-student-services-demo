import { listOnlinePresence } from './listOnlinePresence'
import { computeHandlingStats } from '../../domain/time/computeHandlingStats'
import { startOfKuwaitDay } from '../../domain/time/kuwaitTime'
import type { UserRepository } from '../ports/UserRepository'
import type { VisitRepository } from '../ports/VisitRepository'
import type { BreakRepository } from '../ports/BreakRepository'
import type { Clock } from '../ports/Clock'

export type SupervisionStatus = 'in_session' | 'on_break' | 'idle' | 'away' | 'offline'

export interface CounselorSupervisionView {
  id: string
  name: string
  nameAr: string | null
  isOnline: boolean
  onlineSecondsToday: number
  status: SupervisionStatus
  currentSince: string | null
  lastSeenAt: string | null
  closedToday: number
  avgHandlingMs: number | null
  instantCloseCount: number
  instantCloseAvgMs: number | null
  leftOpenCount: number
  leftOpenAvgMs: number | null
  breakMsToday: number
}

export interface GetCounselorSupervisionDeps {
  userRepository: UserRepository
  visitRepository: VisitRepository
  breakRepository: BreakRepository
  clock: Clock
}

export async function getCounselorSupervision(
  deps: GetCounselorSupervisionDeps
): Promise<CounselorSupervisionView[]> {
  const now = deps.clock.now()
  const startOfDay = startOfKuwaitDay(now)
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const presence = (
    await listOnlinePresence('super_admin', {
      userRepository: deps.userRepository,
      clock: deps.clock,
    })
  ).filter((p) => p.role === 'counselor')

  // بـclosed_at مو created_at: زيارة انفتحت أمس وانقفلت اليوم تُحسب اليوم،
  // نفس ما تحسبها شاشة المستشار بالضبط
  const todaysVisits = await deps.visitRepository.findClosedInRange(startOfDay, endOfDay)

  return Promise.all(
    presence.map(async (p) => {
      const own = todaysVisits.filter((v) => v.counselorId === p.id)
      const {
        closedCount,
        avgHandlingMs,
        instantCloseCount,
        instantCloseAvgMs,
        leftOpenCount,
        leftOpenAvgMs,
      } = computeHandlingStats(own)

      const openBreak = await deps.breakRepository.findOpenBreak(p.id)
      const finishedBreakMs = await deps.breakRepository.sumFinishedBreakMsToday(p.id, now)
      const openBreakMs = openBreak ? now.getTime() - openBreak.startedAt.getTime() : 0
      const breakMsToday = finishedBreakMs + openBreakMs

      const inProgress = await deps.visitRepository.findInProgressForCounselor(p.id)

      // الأولوية للحضور الفعلي: إذا صار المستشار "أوفلاين" (فقد الاتصال، سكّر
      // التبويب) ما نتركه عالق على "في استراحة"/"مع طالب" للأبد لأنه ما قفل
      // الاستراحة أو الزيارة بنفسه — الحالة الحقيقية أهم من حالة نسيها
      let status: SupervisionStatus
      let currentSince: string | null = null
      if (!p.isOnline) {
        status = p.onlineSecondsToday > 0 ? 'away' : 'offline'
      } else if (openBreak) {
        status = 'on_break'
        currentSince = openBreak.startedAt.toISOString()
      } else if (inProgress?.pickedUpAt) {
        status = 'in_session'
        currentSince = inProgress.pickedUpAt.toISOString()
      } else {
        status = 'idle'
      }

      return {
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        isOnline: p.isOnline,
        onlineSecondsToday: p.onlineSecondsToday,
        status,
        currentSince,
        lastSeenAt: p.lastSeenAt ? p.lastSeenAt.toISOString() : null,
        closedToday: closedCount,
        avgHandlingMs,
        instantCloseCount,
        instantCloseAvgMs,
        leftOpenCount,
        leftOpenAvgMs,
        breakMsToday,
      }
    })
  )
}
