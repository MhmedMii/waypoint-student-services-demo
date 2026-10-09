import {
  validateApplicationFields,
  type ApplicationSubmissionInput,
} from '../../domain/validation/validateApplicationFields'
import { pickCounselorForVisaServices } from '../../domain/routing/pickCounselorForVisaServices'
import { pickCounselorForExamServices } from '../../domain/routing/pickCounselorForExamServices'
import { onShiftCandidates } from '../../domain/routing/eligibleCandidates'
import { hasSignedInToday, isCounselorAbsent } from '../../domain/routing/counselorAbsence'
import type { Application, ServiceCode } from '../../domain/entities/application'
import type { ApplicationRepository } from '../ports/ApplicationRepository'
import type { SpecializationRepository } from '../ports/SpecializationRepository'
import type { Clock } from '../ports/Clock'

export interface SubmitApplicationDeps {
  applicationRepository: ApplicationRepository
  specializationRepository: SpecializationRepository
  clock: Clock
}

export type SubmitApplicationResult =
  | {
      ok: true
      application: Application
      assignedWhileAbsent: boolean
      assignedWhileOffShift: boolean
      assignedNotSignedInToday: boolean
    }
  | { ok: false; errors: string[] }

export async function submitApplication(
  input: ApplicationSubmissionInput,
  deps: SubmitApplicationDeps
): Promise<SubmitApplicationResult> {
  const validation = validateApplicationFields(input)
  if (!validation.isValid) return { ok: false, errors: [validation.reason] }

  const candidates = await deps.specializationRepository.findCandidatesForActiveCounselors()
  const onShift = onShiftCandidates(candidates, deps.clock.now())
  // الدور بين اللي بالشفت، سجّلوا دخول أو لا. خارج الشفت احتياط بس
  const scope = input.kind === 'visa' ? 'visa_services' : 'exam_services'
  const lastInCycle = await deps.specializationRepository.findLastAssignedCounselorForScope(scope)
  const pick = (pool: typeof onShift) =>
    input.kind === 'visa'
      ? pickCounselorForVisaServices(pool, lastInCycle)
      : pickCounselorForExamServices(pool, lastInCycle)
  const assigned = pick(onShift) ?? pick(candidates)

  const assignedWhileAbsent =
    assigned !== null && isCounselorAbsent(assigned.lastSeenAt ?? null, deps.clock.now())
  const assignedWhileOffShift =
    assigned !== null && !onShift.some((candidate) => candidate.id === assigned.id)

  const assignedNotSignedInToday =
    assigned !== null && !hasSignedInToday(assigned.lastSeenAt ?? null, deps.clock.now())

  const application = await deps.applicationRepository.create({
    kind: input.kind,
    serviceCode: input.serviceCode as ServiceCode,
    name: input.name.trim(),
    phone: input.phone,
    email: null,
    fields: input.fields as Record<string, string>,
  })

  if (assigned) {
    await deps.applicationRepository.assignCounselor(application.id, assigned.id)
    await deps.specializationRepository.recordAssignment(assigned.id, scope, deps.clock.now())
  }

  return {
    ok: true,
    application: { ...application, counselorId: assigned?.id ?? null },
    assignedWhileAbsent,
    assignedWhileOffShift,
    assignedNotSignedInToday,
  }
}
