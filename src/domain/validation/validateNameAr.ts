export type NameArValidationResult = { isValid: true } | { isValid: false; reason: string }

export const MAX_NAME_AR_LENGTH = 80

export function validateNameAr(nameAr: unknown): NameArValidationResult {
  if (nameAr === null || nameAr === undefined) return { isValid: true }
  if (typeof nameAr !== 'string') {
    return { isValid: false, reason: 'nameArMustBeText' }
  }
  if (nameAr.trim().length > MAX_NAME_AR_LENGTH) {
    return { isValid: false, reason: 'nameArTooLong' }
  }
  return { isValid: true }
}
