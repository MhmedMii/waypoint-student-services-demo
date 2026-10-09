import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { Application, ApplicationKind } from '../../domain/entities/application'
import type { ApplicationRepository } from '../ports/ApplicationRepository'
import { holdsScopeForApplicationKind } from '../../domain/access/applicationScope'

export interface ListApplicationsForScopeDeps {
  applicationRepository: ApplicationRepository
}

export type ListApplicationsForScopeResult =
  { ok: true; applications: Application[] } | { ok: false; reason: string }

// super_admin يشوف الكل — المستشار لازم يملك نطاق التخصص المطابق (visa_services أو exam_services)، والأدمن العادي ما له وصول إطلاقاً
export async function listApplicationsForScope(
  actorRole: UserRole,
  actorScopes: SpecializationScope[],
  kind: ApplicationKind,
  deps: ListApplicationsForScopeDeps
): Promise<ListApplicationsForScopeResult> {
  if (actorRole !== 'super_admin') {
    if (actorRole !== 'counselor' || !holdsScopeForApplicationKind(actorScopes, kind)) {
      return { ok: false, reason: 'notAuthorizedScope' }
    }
  }

  const applications = await deps.applicationRepository.findAllByKind(kind)
  return { ok: true, applications }
}
