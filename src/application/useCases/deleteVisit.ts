import type { UserRole } from '../../domain/entities/user'
import type { VisitRepository } from '../ports/VisitRepository'

export interface DeleteVisitDeps {
  visitRepository: VisitRepository
}

export type DeleteVisitResult = { ok: true } | { ok: false; reason: string }

export async function deleteVisit(
  actorRole: UserRole,
  visitId: string,
  deps: DeleteVisitDeps
): Promise<DeleteVisitResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin' }

  await deps.visitRepository.deleteVisit(visitId)
  return { ok: true }
}
