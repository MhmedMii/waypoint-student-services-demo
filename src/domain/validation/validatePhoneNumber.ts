export type PhoneValidationResult = { isValid: true } | { isValid: false; reason: string }

const KUWAIT_MOBILE_PATTERN = /^[4569]\d{7}$/

export function validatePhoneNumber(rawPhone: string): PhoneValidationResult {
  if (!KUWAIT_MOBILE_PATTERN.test(rawPhone)) {
    return { isValid: false, reason: 'phoneInvalid' }
  }
  return { isValid: true }
}
