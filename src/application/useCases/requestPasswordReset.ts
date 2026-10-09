import type { UserRepository } from '../ports/UserRepository'
import type { PasswordResetTokenRepository } from '../ports/PasswordResetTokenRepository'
import type { EmailSender } from '../ports/EmailSender'
import type { Clock } from '../ports/Clock'
import type { ResetTokenGenerator } from '../ports/ResetTokenGenerator'

export interface RequestPasswordResetDeps {
  userRepository: UserRepository
  tokenRepository: PasswordResetTokenRepository
  emailSender: EmailSender
  clock: Clock
  tokenGenerator: ResetTokenGenerator
  resetLinkBaseUrl: string
}

const TOKEN_TTL_MS = 60 * 60 * 1000

export async function requestPasswordReset(
  email: string,
  deps: RequestPasswordResetDeps
): Promise<{ ok: true }> {
  const user = await deps.userRepository.findByEmail(email)
  if (user && user.active) {
    const rawToken = deps.tokenGenerator.generateToken()
    const tokenHash = deps.tokenGenerator.hashToken(rawToken)
    const now = deps.clock.now()
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS)
    await deps.tokenRepository.create(user.id, tokenHash, expiresAt)
    const resetLink = `${deps.resetLinkBaseUrl}?token=${rawToken}`
    await deps.emailSender.sendPasswordResetEmail(user.email, resetLink)
  }
  return { ok: true }
}
