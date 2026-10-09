import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { ApplicationStatus } from '../../domain/entities/application'
import { canTransitionApplicationStatus } from '../../domain/workflow/applicationStatusTransitions'
import type { ApplicationRepository } from '../ports/ApplicationRepository'
import { holdsScopeForApplicationKind } from '../../domain/access/applicationScope'

export interface UpdateApplicationStatusDeps {
  applicationRepository: ApplicationRepository
}

export type UpdateApplicationStatusResult =
  { ok: true } | { ok: false; reason: string; from?: ApplicationStatus; to?: ApplicationStatus }

const STATUS_NOTE_REQUIRED_FOR: ApplicationStatus[] = ['documents_requested', 'rejected']
const REFERENCE_NUMBER_REQUIRED_FOR: ApplicationStatus[] = ['approved', 'rejected']

export async function updateApplicationStatus(
  actorRole: UserRole,
  actorScopes: SpecializationScope[],
  applicationId: string,
  newStatus: ApplicationStatus,
  statusNote: string | null,
  referenceNumber: string | null,
  deps: UpdateApplicationStatusDeps
): Promise<UpdateApplicationStatusResult> {
  const application = await deps.applicationRepository.findById(applicationId)
  if (!application) return { ok: false, reason: 'applicationNotFound' }

  if (actorRole !== 'super_admin') {
    if (actorRole !== 'counselor' || !holdsScopeForApplicationKind(actorScopes, application.kind)) {
      return { ok: false, reason: 'notAuthorizedScope' }
    }
  }

  if (!canTransitionApplicationStatus(application.status, newStatus)) {
    return {
      ok: false,
      reason: 'invalidStatusTransition',
      from: application.status,
      to: newStatus,
    }
  }

  if (STATUS_NOTE_REQUIRED_FOR.includes(newStatus) && !statusNote?.trim()) {
    return { ok: false, reason: 'statusNoteRequired' }
  }

  if (REFERENCE_NUMBER_REQUIRED_FOR.includes(newStatus) && !referenceNumber?.trim()) {
    return { ok: false, reason: 'referenceNumberRequired' }
  }

  await deps.applicationRepository.updateStatus(
    applicationId,
    newStatus,
    statusNote,
    referenceNumber
  )
  return { ok: true }
}
