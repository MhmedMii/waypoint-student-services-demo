import type { UserRepository } from '../../application/ports/UserRepository'
import type { SpecializationRepository } from '../../application/ports/SpecializationRepository'
import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'

// الجلسة تعيش ٨ ساعات، والدور والنطاقات كانت تُكتب بالتوكن مرة وحدة وقت
// الدخول وبس. يعني موظف ينعطّل الساعة ٩ يضل داخل لين ٥ — ويقرأ أرقام
// العملاء طول اليوم. نتحقق من القاعدة كل دقيقة بدل ما ننتظر التوكن ينتهي
export const REVALIDATE_AFTER_MS = 60 * 1000

export interface SessionToken {
  id?: unknown
  role?: unknown
  scopes?: unknown
  nameAr?: unknown
  checkedAt?: unknown
  [key: string]: unknown
}

export interface RevalidateDeps {
  userRepository: UserRepository
  specializationRepository: SpecializationRepository
}

// توكن بلا id يعني إما مو مسجّل دخول، أو سبق ونزعناه بالأسفل. الحارسان
// requireRole و requireScope يقرآن الدور بـ optional chaining، فغيابه = رفض
function stripped(token: SessionToken): SessionToken {
  const { id, role, scopes, nameAr, ...rest } = token
  return rest
}

export async function revalidateSessionToken(
  token: SessionToken,
  now: number,
  deps: RevalidateDeps
): Promise<SessionToken> {
  if (typeof token.id !== 'string') return token

  // ما نضرب القاعدة بكل طلب: الـ pool عنده ١٠ اتصالات بس ويتشاركها تسجيل
  // الدخول نفسه، فاستعلام إضافي بكل طلب يخنقه. دقيقة تأخير مقابل ٨ ساعات
  const checkedAt = typeof token.checkedAt === 'number' ? token.checkedAt : 0
  if (now - checkedAt < REVALIDATE_AFTER_MS) return token

  const fresh = await deps.userRepository.findById(token.id)
  if (!fresh || !fresh.active) return stripped(token)

  // نفس شرط authorize بالضبط: النطاقات للمستشار فقط. لو ترقّى أو نزل دوره،
  // النطاقات القديمة لازم تروح معه — مو بس الدور
  const scopes: SpecializationScope[] =
    fresh.role === 'counselor'
      ? await deps.specializationRepository.findScopesForCounselor(fresh.id)
      : []

  return {
    ...token,
    role: fresh.role as UserRole,
    nameAr: fresh.nameAr ?? null,
    scopes,
    checkedAt: now,
  }
}
