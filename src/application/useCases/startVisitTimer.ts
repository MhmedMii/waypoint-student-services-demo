import type { Visit } from '../../domain/entities/visit'
import type { VisitRepository } from '../ports/VisitRepository'
import type { Clock } from '../ports/Clock'

export interface StartVisitTimerDeps {
  visitRepository: VisitRepository
  clock: Clock
}

export type StartVisitTimerResult = { ok: true; visit: Visit } | { ok: false; reason: string }

export async function startVisitTimer(
  counselorId: string,
  deps: StartVisitTimerDeps
): Promise<StartVisitTimerResult> {
  const inProgress = await deps.visitRepository.findInProgressForCounselor(counselorId)
  if (inProgress !== null) return { ok: false, reason: 'alreadyServingClient' }

  const queue = await deps.visitRepository.findAssignedQueueForCounselor(counselorId)
  const next = queue.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
  if (!next) return { ok: false, reason: 'noClientWaiting' }

  const pickedUpAt = deps.clock.now()
  await deps.visitRepository.markPickedUp(next.id, pickedUpAt)
  const updated = await deps.visitRepository.findById(next.id)
  return { ok: true, visit: updated as Visit }
}
