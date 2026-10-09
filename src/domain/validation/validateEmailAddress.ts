export type EmailAddressValidationResult = { isValid: true } | { isValid: false; reason: string }

export function validateEmailAddress(email: string): EmailAddressValidationResult {
  const normalized = email.trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return { isValid: false, reason: 'emailInvalid' }
  }
  return { isValid: true }
}
