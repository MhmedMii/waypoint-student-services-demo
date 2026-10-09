import bcrypt from 'bcryptjs'
import type { UserRole } from '../../domain/entities/user'
import type { UserRepository } from '../ports/UserRepository'
import { validatePasswordStrength } from '../../domain/validation/validatePasswordStrength'

export interface ResetPasswordDeps {
  userRepository: UserRepository
}

export type ResetPasswordResult = { ok: true } | { ok: false; reason: string }

export async function resetPassword(
  actorRole: UserRole,
  actorId: string,
  userId: string,
  newPassword: string,
  deps: ResetPasswordDeps
): Promise<ResetPasswordResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin' }

  if (actorId === userId) return { ok: false, reason: 'cannotChangeOwnAccount' }

  const strengthResult = validatePasswordStrength(newPassword)
  if (!strengthResult.isValid) return { ok: false, reason: strengthResult.reason }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await deps.userRepository.setPasswordHash(userId, passwordHash)
  return { ok: true }
}
