import type { UserRole } from '../../domain/entities/user'
import type { UserRepository } from '../ports/UserRepository'

export interface DeactivateAccountDeps {
  userRepository: UserRepository
}

export type DeactivateAccountResult = { ok: true } | { ok: false; reason: string }

export async function deactivateAccount(
  actorRole: UserRole,
  actorId: string,
  userId: string,
  deps: DeactivateAccountDeps
): Promise<DeactivateAccountResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin' }

  if (actorId === userId) return { ok: false, reason: 'cannotChangeOwnAccount' }

  await deps.userRepository.setActive(userId, false)
  return { ok: true }
}
