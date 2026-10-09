import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { ApplicationRepository } from '../ports/ApplicationRepository'
import { holdsScopeForApplicationKind } from '../../domain/access/applicationScope'

export interface SetApplicationPaymentUrlDeps {
  applicationRepository: ApplicationRepository
}

export type SetApplicationPaymentUrlResult = { ok: true } | { ok: false; reason: string }

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function setApplicationPaymentUrl(
  actorRole: UserRole,
  actorScopes: SpecializationScope[],
  applicationId: string,
  paymentUrl: string,
  deps: SetApplicationPaymentUrlDeps
): Promise<SetApplicationPaymentUrlResult> {
  if (!isValidHttpUrl(paymentUrl)) return { ok: false, reason: 'paymentUrlInvalid' }

  const application = await deps.applicationRepository.findById(applicationId)
  if (!application) return { ok: false, reason: 'applicationNotFound' }

  if (actorRole !== 'super_admin') {
    if (actorRole !== 'counselor' || !holdsScopeForApplicationKind(actorScopes, application.kind)) {
      return { ok: false, reason: 'notAuthorizedScope' }
    }
  }

  await deps.applicationRepository.setPaymentUrl(applicationId, paymentUrl)
  return { ok: true }
}
