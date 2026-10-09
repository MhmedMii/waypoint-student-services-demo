import type { EmailSender } from '../../application/ports/EmailSender'

// The demo never opens an SMTP connection or sends mail.
export const nodemailerEmailSender: EmailSender = {
  async sendPasswordResetEmail() {
    return
  },
}
