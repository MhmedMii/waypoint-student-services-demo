import type { UserRole } from '../../domain/entities/user'
import type { UserRepository } from '../ports/UserRepository'

export interface DeleteAccountDeps {
  userRepository: UserRepository
}

export type DeleteAccountResult = { ok: true } | { ok: false; reason: string }

export async function deleteAccount(
  actorRole: UserRole,
  actorId: string,
  userId: string,
  deps: DeleteAccountDeps
): Promise<DeleteAccountResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin' }

  if (actorId === userId) return { ok: false, reason: 'cannotChangeOwnAccount' }

  await deps.userRepository.deleteUser(userId)
  return { ok: true }
}
