import type { VisitRepository } from '../ports/VisitRepository'
import type { UserRepository } from '../ports/UserRepository'
import type { Clock } from '../ports/Clock'
import {
  isCounselorVisibleNow,
  NIGHT_SHIFT_VISIBLE_FROM_MINUTES,
} from '../../domain/time/isCounselorVisibleNow'
import { isCounselorAbsent } from '../../domain/routing/counselorAbsence'

export interface GetVisitQueuePositionDeps {
  visitRepository: VisitRepository
  userRepository: UserRepository
  clock: Clock
}

// شاشة انتظار العميل. الشفت فقط — ولا كلمة عن الغياب: متى يبدأ دوام مستشاره
// خدمة للعميل، أما "ما حضر من ٧ أيام" فشأن داخلي ما يخص الزائر
export interface CounselorShiftInfo {
  shift: 'day' | 'night'
  availableFromMinutes: number
}

export type GetVisitQueuePositionResult =
  | {
      ok: true
      position: number
      counselorName: string | null
      calledIn: boolean
      // موجود فقط إذا دوامه ما بدأ بعد — لو هو بشفته الحين ما فيه شي يُقال
      counselorShift: CounselorShiftInfo | null
    }
  | { ok: false; reason: string }

export async function getVisitQueuePosition(
  visitId: string,
  deps: GetVisitQueuePositionDeps
): Promise<GetVisitQueuePositionResult> {
  const visit = await deps.visitRepository.findById(visitId)
  if (!visit) return { ok: false, reason: 'visitNotFound' }

  const counselor = visit.counselorId ? await deps.userRepository.findById(visit.counselorId) : null

  // "متاح من الساعة ٣" وعدٌ للزائر، والوعد يُشترط فيه أن يكون قابلاً للوفاء:
  // غايب من خمسة أيام دوام يعني الأرجح ما راح يجي الثالثة كمان. نسكت وقتها —
  // ما نقول إنه غايب (ذاك شأن داخلي)، بس ما نعطي موعداً ما نضمنه
  const shift =
    counselor?.shift &&
    !isCounselorVisibleNow(counselor.shift, deps.clock.now()) &&
    !isCounselorAbsent(counselor.lastSeenAt, deps.clock.now())
      ? { shift: counselor.shift, availableFromMinutes: NIGHT_SHIFT_VISIBLE_FROM_MINUTES }
      : null

  if (!visit.counselorId)
    return { ok: true, position: 0, counselorName: null, calledIn: false, counselorShift: null }
  if (visit.pickedUpAt)
    return {
      ok: true,
      position: 0,
      counselorName: counselor?.name ?? null,
      calledIn: true,
      counselorShift: null,
    }

  // position يمثّل عدد الأشخاص قبله بالضبط (صفر يعني هو التالي) — مو ترتيبه بالطابور
  const waiting = await deps.visitRepository.findAssignedQueueForCounselor(visit.counselorId)
  const index = waiting.findIndex((v) => v.id === visit.id)
  const position = index === -1 ? 0 : index

  return {
    ok: true,
    position,
    counselorName: counselor?.name ?? null,
    calledIn: false,
    counselorShift: shift,
  }
}
