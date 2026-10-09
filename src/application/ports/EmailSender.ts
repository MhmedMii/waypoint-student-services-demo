export interface EmailSender {
  sendPasswordResetEmail(to: string, resetLink: string): Promise<void>
}
