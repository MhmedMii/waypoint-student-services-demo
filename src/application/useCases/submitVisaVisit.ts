import { validateVisitorName } from '../../domain/validation/validateVisitorName'
import { validatePhoneNumber } from '../../domain/validation/validatePhoneNumber'
import { isRecentOpenDuplicateVisit } from '../../domain/validation/isRecentOpenDuplicateVisit'
import { pickCounselorForVisaServices } from '../../domain/routing/pickCounselorForVisaServices'
import { onShiftCandidates } from '../../domain/routing/eligibleCandidates'
import { hasSignedInToday, isCounselorAbsent } from '../../domain/routing/counselorAbsence'
import type { Visit } from '../../domain/entities/visit'
import type { VisitRepository } from '../ports/VisitRepository'
import type { SpecializationRepository } from '../ports/SpecializationRepository'
import type { Clock } from '../ports/Clock'

export interface SubmitVisaVisitInput {
  name: string
  phone: string
  createdBy: string | null
  overrideDuplicate?: boolean
}

export interface SubmitVisaVisitDeps {
  visitRepository: VisitRepository
  specializationRepository: SpecializationRepository
  clock: Clock
}

export type SubmitVisaVisitResult =
  | {
      ok: true
      visit: Visit
      // انعطى لواحد غايب لأن ما فيه بديل حاضر — لازم يبان أحمر
      assignedWhileAbsent: boolean
      assignedWhileOffShift: boolean
      assignedNotSignedInToday: boolean
      duplicateOverridden: boolean
    }
  | { ok: false; errors: string[] }

function validateInput(input: SubmitVisaVisitInput): string[] {
  const errors: string[] = []
  const nameResult = validateVisitorName(input.name)
  if (!nameResult.isValid) errors.push(nameResult.reason)
  const phoneResult = validatePhoneNumber(input.phone)
  if (!phoneResult.isValid) errors.push(phoneResult.reason)
  return errors
}

export async function submitVisaVisit(
  input: SubmitVisaVisitInput,
  deps: SubmitVisaVisitDeps
): Promise<SubmitVisaVisitResult> {
  const errors = validateInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const priorVisit = await deps.visitRepository.findMostRecentByPhone(input.phone)
  const wouldHaveBlocked = isRecentOpenDuplicateVisit(priorVisit, deps.clock.now())
  if (!input.overrideDuplicate && wouldHaveBlocked) {
    return { ok: false, errors: ['duplicateVisitPending'] }
  }
  const duplicateOverridden = wouldHaveBlocked

  const candidates = await deps.specializationRepository.findCandidatesForActiveCounselors()
  const onShift = onShiftCandidates(candidates, deps.clock.now())
  // الدور بين اللي بالشفت، سجّلوا دخول أو لا. خارج الشفت احتياط بس
  const lastInCycle =
    await deps.specializationRepository.findLastAssignedCounselorForScope('visa_services')
  const assigned =
    pickCounselorForVisaServices(onShift, lastInCycle) ??
    pickCounselorForVisaServices(candidates, lastInCycle)

  // ما فيه أحد؟ ولا فيه بس كلهم غايبين؟ الفرق يهم المشرف
  const assignedWhileAbsent =
    assigned !== null && isCounselorAbsent(assigned.lastSeenAt ?? null, deps.clock.now())
  const assignedWhileOffShift =
    assigned !== null && !onShift.some((candidate) => candidate.id === assigned.id)

  const assignedNotSignedInToday =
    assigned !== null && !hasSignedInToday(assigned.lastSeenAt ?? null, deps.clock.now())

  const visit = await deps.visitRepository.create({
    type: 'visa',
    name: input.name.trim(),
    phone: input.phone,
    desiredCountry: null,
    counselorId: assigned?.id ?? null,
    // عملاء الجديد والتأشيرة ما يطلبون أحد — التوزيع يختار
    requestedCounselorId: null,
    linkedVisitId: null,
    createdBy: input.createdBy,
  })

  if (assigned) {
    await deps.specializationRepository.recordAssignment(
      assigned.id,
      'visa_services',
      deps.clock.now()
    )
  }

  return {
    ok: true,
    visit,
    assignedWhileAbsent,
    assignedWhileOffShift,
    assignedNotSignedInToday,
    duplicateOverridden,
  }
}
