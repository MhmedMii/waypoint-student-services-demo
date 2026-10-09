import type { UserRole } from '../../domain/entities/user'
import type { UserRepository } from '../ports/UserRepository'

export interface DowngradeSuperAdminDeps {
  userRepository: UserRepository
}

export type DowngradeSuperAdminResult = { ok: true } | { ok: false; reason: string }

// إنزال سوبر أدمن إلى أدمن عادي — حصراً لصلاحية السوبر أدمن الأساسي المحمي
export async function downgradeSuperAdmin(
  actorRole: UserRole,
  actorId: string,
  userId: string,
  deps: DowngradeSuperAdminDeps
): Promise<DowngradeSuperAdminResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin' }
  if (actorId === userId) return { ok: false, reason: 'cannotChangeOwnAccount' }

  const target = await deps.userRepository.findById(userId)
  if (!target) return { ok: false, reason: 'accountNotFound' }
  if (target.role !== 'super_admin') return { ok: false, reason: 'onlySuperAdminDowngradable' }
  await deps.userRepository.setRole(userId, 'admin')
  return { ok: true }
}
