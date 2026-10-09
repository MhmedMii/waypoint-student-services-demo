import type { Visit } from '../../domain/entities/visit'
import type { VisitRepository } from '../ports/VisitRepository'

export interface GetCounselorAssignedVisitsDeps {
  visitRepository: VisitRepository
}

export async function getCounselorAssignedVisits(
  counselorId: string,
  deps: GetCounselorAssignedVisitsDeps
): Promise<Visit[]> {
  return deps.visitRepository.findAllForCounselor(counselorId)
}
