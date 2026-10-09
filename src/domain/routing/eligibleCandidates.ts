import type { CounselorCandidate } from '../entities/counselor'
import { isCounselorVisibleNow } from '../time/isCounselorVisibleNow'

// شرط واحد قبل التوزيع: ضمن دوامه الحين. تسجيل الدخول ما عاد شرطًا — العميل
// ينعطى للمستشار سجّل دخول أو لا؛ المتابعة مسؤوليته، وسطر الغياب تحت اسمه
// والجرس للعلم فقط. اللي خارج شفته احتياط بس، لو ما فيه أحد بالشفت يغطي النطاق
export function onShiftCandidates(
  candidates: CounselorCandidate[],
  now: Date
): CounselorCandidate[] {
  return candidates.filter((candidate) => isCounselorVisibleNow(candidate.shift ?? null, now))
}
