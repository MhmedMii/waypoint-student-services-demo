import bcrypt from 'bcryptjs'
import { isTokenExpired } from '../../domain/time/isTokenExpired'
import { validatePasswordStrength } from '../../domain/validation/validatePasswordStrength'
import type { UserRepository } from '../ports/UserRepository'
import type { PasswordResetTokenRepository } from '../ports/PasswordResetTokenRepository'
import type { Clock } from '../ports/Clock'
import type { ResetTokenGenerator } from '../ports/ResetTokenGenerator'

export interface CompletePasswordResetDeps {
  userRepository: UserRepository
  tokenRepository: PasswordResetTokenRepository
  clock: Clock
  tokenGenerator: ResetTokenGenerator
}

export type CompletePasswordResetResult = { ok: true } | { ok: false; reason: string }

// الترتيب كان: نحرق التوكن أول، بعدين نفحص. فكلمة سر ضعيفة تحرق الرابط —
// المستخدم يصحّح ويعيد فيلقى "الرابط غير صالح"، ويرجع لـ"نسيت كلمة السر"
// المحدودة بخمس مرات كل ربع ساعة. غلطة كتابة تقفله برا حسابه.
//
// الآن كل فحص ممكن يفشل يصير قبل الحرق، ويقرأ بس. الحرق نفسه (claimToken)
// يبقى آخر خطوة وذرّية: هو اللي يمنع طلبين متزامنين ينجحون الاثنين، لأن
// الاثنين ممكن يعدّون الفحوصات قبل ما أي واحد يحرق
export async function completePasswordReset(
  rawToken: string,
  newPassword: string,
  deps: CompletePasswordResetDeps
): Promise<CompletePasswordResetResult> {
  const tokenHash = deps.tokenGenerator.hashToken(rawToken)
  const now = deps.clock.now()

  const record = await deps.tokenRepository.findByTokenHash(tokenHash)
  if (!record || record.usedAt !== null) {
    return { ok: false, reason: 'resetLinkInvalid' }
  }

  // المنتهي كان يُعلَّم مستخدمًا قبل هالفحص — ما ضرّ أحد، بس يبيّن إن
  // الترتيب كان غلط بكل مكان مو بمكان واحد
  if (isTokenExpired(record.expiresAt, now)) {
    return { ok: false, reason: 'resetLinkExpired' }
  }

  const user = await deps.userRepository.findById(record.userId)
  if (!user || !user.active) {
    return { ok: false, reason: 'accountInactive' }
  }

  const strengthResult = validatePasswordStrength(newPassword)
  if (!strengthResult.isValid) return { ok: false, reason: strengthResult.reason }

  // نحسب البصمة قبل الحرق: لو فشلت هي، التوكن يظل صالحًا للمحاولة الثانية
  const passwordHash = await bcrypt.hash(newPassword, 12)

  const claimed = await deps.tokenRepository.claimToken(tokenHash, now)
  // سبقنا طلب ثاني بنفس الرابط بين القراءة والحرق — نفس جواب الرابط المستخدم
  if (!claimed) return { ok: false, reason: 'resetLinkInvalid' }

  await deps.userRepository.setPasswordHash(claimed.userId, passwordHash)
  return { ok: true }
}
