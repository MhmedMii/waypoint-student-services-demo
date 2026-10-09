import type { UserRole } from '../entities/user'

export type RoleValidationResult = { isValid: true } | { isValid: false; reason: string }

const VALID_ROLES: UserRole[] = ['counselor', 'admin', 'super_admin']

// نتأكد إن الدور جاي من القيم المسموحة بس، قبل لا نستخدمه بإنشاء الحساب
export function validateRole(role: string): RoleValidationResult {
  if (!VALID_ROLES.includes(role as UserRole)) {
    return { isValid: false, reason: 'roleInvalid' }
  }
  return { isValid: true }
}
