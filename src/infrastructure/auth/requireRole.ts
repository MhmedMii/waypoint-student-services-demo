// src/infrastructure/auth/requireRole.ts
import type { Session } from 'next-auth'
import type { UserRole } from '../../domain/entities/user'

export type RequireRoleResult = { ok: true } | { ok: false; redirectTo: string }

export function requireRole(session: Session | null, allowedRoles: UserRole[]): RequireRoleResult {
  const role = session?.user?.role as UserRole | undefined
  if (!role || !allowedRoles.includes(role)) {
    return { ok: false, redirectTo: '/login' }
  }
  return { ok: true }
}
