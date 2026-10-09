import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '../../../../application/useCases/requestPasswordReset'
import {
  isForgotPasswordRateLimited,
  recordForgotPasswordRequest,
} from '../../../../infrastructure/auth/forgotPasswordRateLimiter'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { createPostgresPasswordResetTokenRepository } from '../../../../adapters/repositories/postgresPasswordResetTokenRepository'
import { nodemailerEmailSender } from '../../../../infrastructure/email/nodemailerEmailSender'
import { systemClock } from '../../../../infrastructure/db/systemClock'
import { resetTokenGenerator } from '../../../../infrastructure/auth/passwordResetToken'

// جسم فاضي {} كان يوصل email = undefined لحد الـ rate limiter، وهناك
// email.trim() يرمي — 500 بلا تسجيل دخول. نفس علّة مسار إعادة التعيين
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalidRequest' }, { status: 400 })
  }

  // ٤٠٠ هنا معناها "الطلب نفسه مكسور"، مو "الإيميل مو موجود" — الفرق مهم:
  // لو رددنا بشكل مختلف على إيميل غير مسجّل نكون كشفنا من عندنا حساب ومن لا
  const { email } = (body ?? {}) as Record<string, unknown>
  if (typeof email !== 'string' || email.trim() === '') {
    return NextResponse.json({ ok: false, reason: 'invalidRequest' }, { status: 400 })
  }

  const now = Date.now()

  // إذا تجاوز الحد المسموح، نرجع نفس الرد المعتاد بدون ما نكشف إنه تم تحديد (rate limit) — عشان ما نسرب معلومة
  if (await isForgotPasswordRateLimited(email, now)) {
    return NextResponse.json({ ok: true })
  }
  await recordForgotPasswordRequest(email, now)

  const result = await requestPasswordReset(email, {
    userRepository: createPostgresUserRepository(pool),
    tokenRepository: createPostgresPasswordResetTokenRepository(pool),
    emailSender: nodemailerEmailSender,
    clock: systemClock,
    tokenGenerator: resetTokenGenerator,
    resetLinkBaseUrl: `${process.env.NEXTAUTH_URL}/reset-password`,
  })
  return NextResponse.json(result)
}
