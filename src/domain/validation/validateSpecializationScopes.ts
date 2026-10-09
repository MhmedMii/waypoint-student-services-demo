import { COUNTRY_SCOPES, type SpecializationScope } from '../entities/counselor'

export type ScopesValidationResult = { isValid: true } | { isValid: false; reason: string }

const VALID_SCOPES: SpecializationScope[] = [...COUNTRY_SCOPES, 'visa_services', 'exam_services']

// نتأكد إن كل قيمة بمصفوفة النطاقات (scopes) صالحة قبل لا نخزّنها بجدول التخصصات
export function validateSpecializationScopes(scopes: unknown[]): ScopesValidationResult {
  const hasInvalidScope = scopes.some(
    (scope) => !VALID_SCOPES.includes(scope as SpecializationScope)
  )
  if (hasInvalidScope) {
    return { isValid: false, reason: 'scopesInvalid' }
  }
  return { isValid: true }
}
