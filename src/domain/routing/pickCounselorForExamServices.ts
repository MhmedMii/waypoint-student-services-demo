import type { CounselorCandidate } from '../entities/counselor'
import { pickNextInRotation } from './pickNextInRotation'

export function pickCounselorForExamServices(
  counselors: CounselorCandidate[],
  lastAssignedCounselorId: string | null
): CounselorCandidate | null {
  const candidates = counselors.filter((c) => c.scopes.includes('exam_services'))
  return pickNextInRotation(candidates, lastAssignedCounselorId)
}
