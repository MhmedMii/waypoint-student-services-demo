import type { UserRole } from '../../domain/entities/user'
import type { VisitRepository } from '../ports/VisitRepository'

export interface ReassignVisitDeps {
  visitRepository: VisitRepository
}

export type ReassignVisitResult = { ok: true } | { ok: false; reason: string }

export async function reassignVisit(
  actorRole: UserRole,
  visitId: string,
  counselorId: string | null,
  deps: ReassignVisitDeps
): Promise<ReassignVisitResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin' }

  await deps.visitRepository.updateCounselor(visitId, counselorId)
  return { ok: true }
}
