import type { UserRole } from '../../domain/entities/user'
import type { UserRepository } from '../ports/UserRepository'

export const MAX_SUPER_ADMINS = 2

export interface PromoteToSuperAdminDeps {
  userRepository: UserRepository
}

export type PromoteToSuperAdminResult = { ok: true } | { ok: false; reason: string }

export async function promoteToSuperAdmin(
  actorRole: UserRole,
  userId: string,
  deps: PromoteToSuperAdminDeps
): Promise<PromoteToSuperAdminResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin' }

  const target = await deps.userRepository.findById(userId)
  if (!target) return { ok: false, reason: 'accountNotFound' }
  if (target.role !== 'admin') return { ok: false, reason: 'onlyAdminPromotable' }

  const superAdminCount = await deps.userRepository.countByRole('super_admin')
  if (superAdminCount >= MAX_SUPER_ADMINS) return { ok: false, reason: 'maxSuperAdminsReached' }

  await deps.userRepository.setRole(userId, 'super_admin')
  return { ok: true }
}
