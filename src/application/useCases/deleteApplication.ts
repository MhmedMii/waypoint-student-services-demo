import type { UserRole } from '../../domain/entities/user'
import type { ApplicationRepository } from '../ports/ApplicationRepository'

export interface DeleteApplicationDeps {
  applicationRepository: ApplicationRepository
}

export type DeleteApplicationResult = { ok: true } | { ok: false; reason: string }

export async function deleteApplication(
  actorRole: UserRole,
  applicationId: string,
  deps: DeleteApplicationDeps
): Promise<DeleteApplicationResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin' }

  await deps.applicationRepository.deleteApplication(applicationId)
  return { ok: true }
}
