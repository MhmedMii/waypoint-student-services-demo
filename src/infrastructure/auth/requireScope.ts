import type { Session } from 'next-auth'
import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'

export type RequireScopeResult = { ok: true } | { ok: false; redirectTo: string }

// super_admin يشوف كل شيء — المستشار لازم يملك نطاق التخصص المطلوب — الأدمن العادي مستبعد تماماً من هذا التحقق
export function requireScope(
  session: Session | null,
  scope: SpecializationScope
): RequireScopeResult {
  const role = session?.user?.role as UserRole | undefined
  if (role === 'super_admin') return { ok: true }

  if (role !== 'counselor') return { ok: false, redirectTo: '/login' }

  const scopes = session?.user?.scopes as SpecializationScope[] | undefined
  if (!scopes?.includes(scope)) return { ok: false, redirectTo: '/login' }

  return { ok: true }
}
