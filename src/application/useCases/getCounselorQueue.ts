import { computeElapsedTime, type ElapsedTime } from '../../domain/time/computeElapsedTime'
import { computeHandlingStats } from '../../domain/time/computeHandlingStats'
import { startOfKuwaitDay } from '../../domain/time/kuwaitTime'
import type { Visit } from '../../domain/entities/visit'
import type { VisitRepository } from '../ports/VisitRepository'
import type { BreakRepository } from '../ports/BreakRepository'
import type { Clock } from '../ports/Clock'

export interface GetCounselorQueueDeps {
  visitRepository: VisitRepository
  breakRepository: BreakRepository
  clock: Clock
}

export interface CounselorQueueView {
  currentVisit: Visit | null
  elapsed: ElapsedTime
  waitingCount: number
  nextWaitingName: string | null
  breakTotalMsToday: number
  openBreakElapsed: ElapsedTime
  servedToday: number
  avgHandlingMs: number | null
}

export async function getCounselorQueue(
  counselorId: string,
  deps: GetCounselorQueueDeps
): Promise<CounselorQueueView> {
  const now = deps.clock.now()
  const inProgress = await deps.visitRepository.findInProgressForCounselor(counselorId)
  const waiting = await deps.visitRepository.findAssignedQueueForCounselor(counselorId)
  const openBreak = await deps.breakRepository.findOpenBreak(counselorId)
  const breakTotalMsToday = await deps.breakRepository.sumFinishedBreakMsToday(counselorId, now)

  // نفس المصدر ونفس القاعدة اللي تستخدمها شاشة الإشراف: زيارات أُغلقت اليوم
  // (بتوقيت الكويت)، والمتوسط يستثني أقل من دقيقتين وأكثر من ٨ ساعات. قبل، كانت
  // هذي الشاشة تحسب متوسط بسيط بالـSQL — فنفس المستشار بنفس اليوم له رقمان
  const startOfDay = startOfKuwaitDay(now)
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
  const closedToday = (await deps.visitRepository.findClosedInRange(startOfDay, endOfDay)).filter(
    (visit) => visit.counselorId === counselorId
  )
  // عدد الإغلاقات الفورية يبقى للمشرفين — ما نعرضه بشاشة المستشار
  const handlingToday = computeHandlingStats(closedToday)

  return {
    currentVisit: inProgress,
    elapsed: computeElapsedTime(inProgress?.pickedUpAt ?? null, inProgress?.closedAt ?? null, now),
    waitingCount: waiting.length,
    nextWaitingName: waiting[0]?.name ?? null,
    breakTotalMsToday,
    openBreakElapsed: computeElapsedTime(
      openBreak?.startedAt ?? null,
      openBreak?.endedAt ?? null,
      now
    ),
    servedToday: handlingToday.closedCount,
    avgHandlingMs: handlingToday.avgHandlingMs,
  }
}
