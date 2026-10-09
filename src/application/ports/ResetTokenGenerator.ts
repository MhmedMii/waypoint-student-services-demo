export interface ResetTokenGenerator {
  generateToken(): string
  hashToken(token: string): string
}
