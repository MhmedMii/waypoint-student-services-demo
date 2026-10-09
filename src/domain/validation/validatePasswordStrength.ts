export type PasswordStrengthValidationResult =
  { isValid: true } | { isValid: false; reason: string }

const MIN_PASSWORD_LENGTH = 8

// أقل شرط لقوة كلمة السر المولّدة من الأدمن — طول أدنى بس، بدون تعقيد زايد
export function validatePasswordStrength(password: string): PasswordStrengthValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { isValid: false, reason: 'passwordTooWeak' }
  }
  return { isValid: true }
}
