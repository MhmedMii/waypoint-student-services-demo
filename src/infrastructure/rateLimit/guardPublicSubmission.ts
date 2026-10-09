import type { NextRequest } from 'next/server'
import { getClientIp } from './getClientIp'
import { isIpSubmissionRateLimited, recordSubmissionAttempt } from './ipSubmissionRateLimiter'
import { isRepeatSubmitterBlocked, recordPhoneSubmission } from './repeatSubmitterLimiter'

// نقاط النهاية العامة (الكشك وطلبات التأشيرة/الاختبار) تكتب بقاعدة البيانات بدون
// تسجيل دخول، فلازم يكون فيه حد لعدد الطلبات من نفس الجهاز. لما الـ IP مجهول ما
// نحظر ولا نسجل — عشان ما نصنع سلة مشتركة تحظر كل الناس مع بعض.
export async function guardPublicSubmission(
  request: NextRequest,
  now: number
): Promise<{ tooMany: true } | { tooMany: false }> {
  const ip = getClientIp(request)
  if (ip === 'unknown') return { tooMany: false }

  if (await isIpSubmissionRateLimited(ip, now)) return { tooMany: true }
  await recordSubmissionAttempt(ip, now)
  return { tooMany: false }
}

// طبقة ثانية بعد قراءة الفورم: نفس الشخص (نفس الرقم) ما يرسل أكثر من ثلاث مرات
// بربع ساعة. لازم تنادى بعد ما نعرف الرقم، عكس حظر الـ IP اللي يصير قبل القراءة.
export async function guardRepeatSubmitter(
  phone: unknown,
  now: number
): Promise<{ tooMany: true } | { tooMany: false }> {
  if (typeof phone !== 'string' || phone.trim() === '') return { tooMany: false }

  if (await isRepeatSubmitterBlocked(phone, now)) return { tooMany: true }
  await recordPhoneSubmission(phone, now)
  return { tooMany: false }
}
