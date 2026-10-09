import { validateVisitorName } from '../../domain/validation/validateVisitorName'
import { validatePhoneNumber } from '../../domain/validation/validatePhoneNumber'
import { isRecentOpenDuplicateVisit } from '../../domain/validation/isRecentOpenDuplicateVisit'
import type { Visit } from '../../domain/entities/visit'
import type { VisitRepository } from '../ports/VisitRepository'
import type { UserRepository } from '../ports/UserRepository'
import type { Clock } from '../ports/Clock'

export interface SubmitFollowUpVisitInput {
  name: string
  phone: string
  counselorId: string
  createdBy: string | null
  overrideDuplicate?: boolean
}

export interface SubmitFollowUpVisitDeps {
  visitRepository: VisitRepository
  userRepository: UserRepository
  clock: Clock
}

export type SubmitFollowUpVisitResult =
  { ok: true; visit: Visit; duplicateOverridden: boolean } | { ok: false; errors: string[] }

function validateInput(input: SubmitFollowUpVisitInput): string[] {
  const errors: string[] = []
  const nameResult = validateVisitorName(input.name)
  if (!nameResult.isValid) errors.push(nameResult.reason)
  const phoneResult = validatePhoneNumber(input.phone)
  if (!phoneResult.isValid) errors.push(phoneResult.reason)
  if (!input.counselorId) errors.push('counselorRequired')
  return errors
}

async function isActiveCounselor(
  counselorId: string,
  userRepository: UserRepository
): Promise<boolean> {
  const counselor = await userRepository.findById(counselorId)
  return counselor !== null && counselor.role === 'counselor' && counselor.active
}

export async function submitFollowUpVisit(
  input: SubmitFollowUpVisitInput,
  deps: SubmitFollowUpVisitDeps
): Promise<SubmitFollowUpVisitResult> {
  const errors = validateInput(input)
  if (errors.length > 0) return { ok: false, errors }

  // نتأكد إن الكاونسلر المختار موجود وفعّال قبل لا نوصل لجدول الزيارات — عشان ما توصل قيمة غلط لعمود الـ FK
  if (!(await isActiveCounselor(input.counselorId, deps.userRepository))) {
    return { ok: false, errors: ['counselorNotAvailable'] }
  }

  const mostRecentVisit = await deps.visitRepository.findMostRecentByPhone(input.phone)
  const wouldHaveBlocked = isRecentOpenDuplicateVisit(mostRecentVisit, deps.clock.now())
  if (!input.overrideDuplicate && wouldHaveBlocked) {
    return { ok: false, errors: ['duplicateVisitPending'] }
  }
  const duplicateOverridden = wouldHaveBlocked

  // لازم نربط زيارة المتابعة بأصل الزيارة الجديدة (type = 'new')، مو بآخر زيارة متابعة سابقة
  const priorVisit = await deps.visitRepository.findMostRecentNewVisitByPhone(input.phone)

  const visit = await deps.visitRepository.create({
    type: 'follow_up',
    name: input.name.trim(),
    phone: input.phone,
    desiredCountry: null,
    counselorId: input.counselorId,
    // "جاء إلى" — يبقى حتى لو المشرف نقله لغيره
    requestedCounselorId: input.counselorId,
    linkedVisitId: priorVisit?.id ?? null,
    createdBy: input.createdBy,
  })

  return { ok: true, visit, duplicateOverridden }
}
