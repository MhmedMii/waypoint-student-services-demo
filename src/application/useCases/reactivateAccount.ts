import type { UserRole } from '../../domain/entities/user'
import type { UserRepository } from '../ports/UserRepository'

export interface ReactivateAccountDeps {
  userRepository: UserRepository
}

export type ReactivateAccountResult = { ok: true } | { ok: false; reason: string }

export async function reactivateAccount(
  actorRole: UserRole,
  userId: string,
  deps: ReactivateAccountDeps
): Promise<ReactivateAccountResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin' }

  await deps.userRepository.setActive(userId, true)
  return { ok: true }
}
