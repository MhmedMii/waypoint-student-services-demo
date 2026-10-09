import type { VisitStatus } from '../entities/visit'

// نفس الرقم يقدّم فورم ثاني بعد دقايق من الأول، عادةً لأنه متأكد ما انسجل —
// لو الزيارة الأولى لسا مفتوحة (status = 'next') وضمن آخر نص ساعة، نعتبرها
// تكرار. لو انسكّرت (خدموه بسرعة) أو مرّ عليها وقت أطول، فزيارة جديدة شرعية
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000

interface PriorVisitLike {
  status: VisitStatus
  createdAt: Date
}

export function isRecentOpenDuplicateVisit(priorVisit: PriorVisitLike | null, now: Date): boolean {
  if (!priorVisit) return false
  if (priorVisit.status !== 'next') return false
  const elapsedMs = Math.max(0, now.getTime() - priorVisit.createdAt.getTime())
  return elapsedMs < DUPLICATE_WINDOW_MS
}
