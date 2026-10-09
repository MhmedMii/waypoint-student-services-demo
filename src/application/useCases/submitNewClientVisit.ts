import { validateVisitorName } from '../../domain/validation/validateVisitorName'
import { validatePhoneNumber } from '../../domain/validation/validatePhoneNumber'
import { isRecentOpenDuplicateVisit } from '../../domain/validation/isRecentOpenDuplicateVisit'
import { pickCounselorForCountry } from '../../domain/routing/pickCounselorForCountry'
import { findStickyCounselor } from '../../domain/routing/findStickyCounselor'
import { onShiftCandidates } from '../../domain/routing/eligibleCandidates'
import { hasSignedInToday, isCounselorAbsent } from '../../domain/routing/counselorAbsence'
import type { Visit } from '../../domain/entities/visit'
import type { SpecializationScope } from '../../domain/entities/counselor'

export type UnassignedReasonKind = 'noneCoverScope' | 'onlyDeactivated'
import type { VisitRepository } from '../ports/VisitRepository'
import type { SpecializationRepository } from '../ports/SpecializationRepository'
import type { Clock } from '../ports/Clock'

export interface SubmitNewClientVisitInput {
  name: string
  phone: string
  desiredCountry: string
  createdBy: string | null
  // العميل يرسلها true بعد ما يضغط "استمرار" فوق تحذير التكرار — شخص ثاني
  // يستخدم نفس رقم الجوال (زي الإخوان)، مو نفس الشخص يعيد الإرسال بالغلط
  overrideDuplicate?: boolean
}

export interface SubmitNewClientVisitDeps {
  visitRepository: VisitRepository
  specializationRepository: SpecializationRepository
  clock: Clock
}

export type SubmitNewClientVisitResult =
  | {
      ok: true
      visit: Visit
      // انعطى لواحد غايب لأن ما فيه بديل حاضر — لازم يبان أحمر
      assignedWhileAbsent: boolean
      assignedWhileOffShift: boolean
      // ليش ما انعيّن أحد: ما فيه من يغطي الوجهة، ولا كلهم خارج الشفت
      unassignedReason: UnassignedReasonKind | null
      scopeHoldersOffShift: number
      assignedNotSignedInToday: boolean
      duplicateOverridden: boolean
    }
  | { ok: false; errors: string[] }

function validateInput(input: SubmitNewClientVisitInput): string[] {
  const errors: string[] = []
  const nameResult = validateVisitorName(input.name)
  if (!nameResult.isValid) errors.push(nameResult.reason)
  const phoneResult = validatePhoneNumber(input.phone)
  if (!phoneResult.isValid) errors.push(phoneResult.reason)
  return errors
}

export async function submitNewClientVisit(
  input: SubmitNewClientVisitInput,
  deps: SubmitNewClientVisitDeps
): Promise<SubmitNewClientVisitResult> {
  const errors = validateInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const candidates = await deps.specializationRepository.findCandidatesForActiveCounselors()
  const onShift = onShiftCandidates(candidates, deps.clock.now())

  // زبون راجع يترابط بنفس المستشار اللي شافه آخر مرة، إذا لسا موجود وظاهر بالشفت الحالي — غير كذا نرجع للتوزيع العادي
  const priorVisit = await deps.visitRepository.findMostRecentByPhone(input.phone)

  // الفرق مهم: "أرسل الفورم ومعه العلم مرفوع" غير "فعلاً كان فيه تحذير وتخطّاه"
  const wouldHaveBlocked = isRecentOpenDuplicateVisit(priorVisit, deps.clock.now())
  if (!input.overrideDuplicate && wouldHaveBlocked) {
    return { ok: false, errors: ['duplicateVisitPending'] }
  }
  const duplicateOverridden = wouldHaveBlocked

  // الراجع يرجع لمستشاره، سجّل دخول أو لا (بشرط إنه بالشفت). غير كذا الدور:
  // اللي بالشفت أولاً، سجّل دخول أو لا — وخارج الشفت احتياط، عشان ما يبقى عميل
  // بلا صاحب وفيه مستشار فعّال يغطي وجهته
  const sticky = findStickyCounselor(priorVisit?.counselorId ?? null, onShift)
  const scope = input.desiredCountry as SpecializationScope
  const lastInCycle = sticky
    ? null
    : await deps.specializationRepository.findLastAssignedCounselorForScope(scope)
  const assigned =
    sticky ??
    pickCounselorForCountry(onShift, input.desiredCountry, lastInCycle) ??
    pickCounselorForCountry(candidates, input.desiredCountry, lastInCycle)

  // المعطّل مستثنى من المرشحين أصلاً، فبدون هالسؤال نقول "ما فيه أحد يغطيها"
  // وإحنا عارفين إن فيه — حسابه مقفل بس
  const deactivatedHolders =
    assigned === null
      ? await deps.specializationRepository.countDeactivatedScopeHolders(
          input.desiredCountry as SpecializationScope
        )
      : 0
  // ما عاد "خارج الشفت" سبب: الاحتياط يوصلهم. بقي سببان فقط
  const unassignedReason: UnassignedReasonKind | null =
    assigned !== null ? null : deactivatedHolders > 0 ? 'onlyDeactivated' : 'noneCoverScope'
  const scopeHoldersOffShift = deactivatedHolders

  const assignedWhileAbsent =
    assigned !== null && isCounselorAbsent(assigned.lastSeenAt ?? null, deps.clock.now())
  // انعطى لواحد دوامه مسائي وهو الحين خارج الشفت — يستلمه لما يجي
  const assignedWhileOffShift =
    assigned !== null && !onShift.some((candidate) => candidate.id === assigned.id)

  // انعطى لواحد ما فتح التطبيق اليوم — يستلم، بس المشرف لازم يشوفها
  const assignedNotSignedInToday =
    assigned !== null && !hasSignedInToday(assigned.lastSeenAt ?? null, deps.clock.now())

  const visit = await deps.visitRepository.create({
    type: 'new',
    name: input.name.trim(),
    phone: input.phone,
    desiredCountry: input.desiredCountry,
    counselorId: assigned?.id ?? null,
    // عملاء الجديد والتأشيرة ما يطلبون أحد — التوزيع يختار
    requestedCounselorId: null,
    linkedVisitId: null,
    createdBy: input.createdBy,
  })

  // الراجع لمستشاره ما ياخذ دور من الدورة
  if (assigned && !sticky) {
    await deps.specializationRepository.recordAssignment(assigned.id, scope, deps.clock.now())
  }

  return {
    ok: true,
    visit,
    assignedWhileAbsent,
    assignedWhileOffShift,
    unassignedReason,
    scopeHoldersOffShift,
    assignedNotSignedInToday,
    duplicateOverridden,
  }
}
