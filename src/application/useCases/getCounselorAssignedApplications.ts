import type { Application } from '../../domain/entities/application'
import type { ApplicationRepository } from '../ports/ApplicationRepository'

export interface GetCounselorAssignedApplicationsDeps {
  applicationRepository: ApplicationRepository
}

export async function getCounselorAssignedApplications(
  counselorId: string,
  deps: GetCounselorAssignedApplicationsDeps
): Promise<Application[]> {
  return deps.applicationRepository.findByCounselor(counselorId)
}
