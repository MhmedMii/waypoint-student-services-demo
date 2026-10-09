import type { BreakRecord, BreakRepository } from '../ports/BreakRepository'
import type { VisitRepository } from '../ports/VisitRepository'
import type { Clock } from '../ports/Clock'

export interface BreakOutDeps {
  visitRepository: VisitRepository
  breakRepository: BreakRepository
  clock: Clock
}

export type BreakOutResult = { ok: true; break: BreakRecord } | { ok: false; reason: string }

async function isCounselorIdle(
  counselorId: string,
  visitRepository: VisitRepository
): Promise<boolean> {
  const inProgress = await visitRepository.findInProgressForCounselor(counselorId)
  return inProgress === null
}

export async function breakOut(counselorId: string, deps: BreakOutDeps): Promise<BreakOutResult> {
  const idle = await isCounselorIdle(counselorId, deps.visitRepository)
  if (!idle) return { ok: false, reason: 'breakWhileServing' }

  // ضغطتان متتاليتان على شاشة لمس سلوك عادي، مو حالة نادرة. وكل ضغطة كانت
  // تفتح صفًا جديدًا، ثم endBreak يقفلهم كلهم بنفس الوقت — فاستراحة نصف ساعة
  // تُحسب ساعة، ومعها كل متوسط مبني على وقت الاستراحة. الاستراحة المفتوحة
  // وحدة: لو فيه وحدة نرجّعها كما هي بدل ما نفتح ثانية
  const alreadyOpen = await deps.breakRepository.findOpenBreak(counselorId)
  if (alreadyOpen) return { ok: true, break: alreadyOpen }

  const record = await deps.breakRepository.startBreak(counselorId, deps.clock.now())
  return { ok: true, break: record }
}
