import type { CounselorCandidate } from '../entities/counselor'
import { pickNextInRotation } from './pickNextInRotation'

export type { CounselorCandidate }

export function pickCounselorForCountry(
  counselors: CounselorCandidate[],
  desiredCountry: string,
  lastAssignedCounselorId: string | null
): CounselorCandidate | null {
  const candidates = counselors.filter((c) => (c.scopes as string[]).includes(desiredCountry))
  return pickNextInRotation(candidates, lastAssignedCounselorId)
}
