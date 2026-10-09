import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { ApplicationRepository } from '../ports/ApplicationRepository'
import { holdsScopeForApplicationKind } from '../../domain/access/applicationScope'

export interface AssignApplicationCounselorDeps {
  applicationRepository: ApplicationRepository
}

export type AssignApplicationCounselorResult = { ok: true } | { ok: false; reason: string }

export async function assignApplicationCounselor(
  actorRole: UserRole,
  actorScopes: SpecializationScope[],
  applicationId: string,
  counselorId: string | null,
  deps: AssignApplicationCounselorDeps
): Promise<AssignApplicationCounselorResult> {
  const application = await deps.applicationRepository.findById(applicationId)
  if (!application) return { ok: false, reason: 'applicationNotFound' }

  if (actorRole !== 'super_admin') {
    if (actorRole !== 'counselor' || !holdsScopeForApplicationKind(actorScopes, application.kind)) {
      return { ok: false, reason: 'notAuthorizedScope' }
    }
  }

  await deps.applicationRepository.assignCounselor(applicationId, counselorId)
  return { ok: true }
}
