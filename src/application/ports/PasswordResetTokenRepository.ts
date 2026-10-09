export interface PasswordResetTokenRecord {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
}

export interface PasswordResetTokenRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetTokenRecord>
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>
  markUsed(id: string, usedAt: Date): Promise<void>
  claimToken(tokenHash: string, usedAt: Date): Promise<PasswordResetTokenRecord | null>
}
