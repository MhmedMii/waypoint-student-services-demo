import { randomBytes, createHash } from 'crypto'
import type { ResetTokenGenerator } from '../../application/ports/ResetTokenGenerator'

export function generateResetToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const resetTokenGenerator: ResetTokenGenerator = {
  generateToken: generateResetToken,
  hashToken: hashResetToken,
}
