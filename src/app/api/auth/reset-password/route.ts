import { NextRequest, NextResponse } from 'next/server'
import { completePasswordReset } from '../../../../application/useCases/completePasswordReset'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { createPostgresPasswordResetTokenRepository } from '../../../../adapters/repositories/postgresPasswordResetTokenRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'
import { resetTokenGenerator } from '../../../../infrastructure/auth/passwordResetToken'
import {
  isResetPasswordRateLimited,
  recordResetPasswordAttempt,
} from '../../../../infrastructure/auth/resetPasswordRateLimiter'
import { getClientIp } from '../../../../infrastructure/rateLimit/getClientIp'

// المسار مفتوح بدون تسجيل دخول، وكان يفكّك الجسم على طول: جسم فاضي {} يخلي
// hashToken يستقبل undefined فيرمي، والنتيجة 500 مع stack trace بالسجل — أي
// أحد يقدر يولّدها بطلب واحد. الجسم الغلط جوابه 400، مو انهيار
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalidRequest' }, { status: 400 })
  }

  const { token, newPassword } = (body ?? {}) as Record<string, unknown>
  if (typeof token !== 'string' || token === '') {
    return NextResponse.json({ ok: false, reason: 'invalidRequest' }, { status: 400 })
  }
  if (typeof newPassword !== 'string' || newPassword === '') {
    return NextResponse.json({ ok: false, reason: 'invalidRequest' }, { status: 400 })
  }

  // الحد يجي بعد التحقق من الشكل: جسم مكسور ما يستاهل سطر بجدول الحظر.
  // ولو ما عرفنا الـ IP ما نحظر إطلاقاً — سلة "unknown" وحدة يتشاركها الكل،
  // وحظرها يقفل إعادة التعيين بوجه الجميع مرة وحدة
  const ip = getClientIp(request)
  const now = Date.now()
  if (ip !== 'unknown') {
    if (await isResetPasswordRateLimited(ip, now)) {
      return NextResponse.json({ ok: false, reason: 'tooManyAttempts' }, { status: 429 })
    }
    await recordResetPasswordAttempt(ip, now)
  }

  const result = await completePasswordReset(token, newPassword, {
    userRepository: createPostgresUserRepository(pool),
    tokenRepository: createPostgresPasswordResetTokenRepository(pool),
    clock: systemClock,
    tokenGenerator: resetTokenGenerator,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
