import type { CounselorCandidate } from '../entities/counselor'
import { pickNextInRotation } from './pickNextInRotation'

// لازم نحصر مرشحين خدمات الفيزا بس بالي عندهم سكوب visa_services صراحة، سكوب all مو كافي هني
export function pickCounselorForVisaServices(
  counselors: CounselorCandidate[],
  lastAssignedCounselorId: string | null
): CounselorCandidate | null {
  const candidates = counselors.filter((c) => c.scopes.includes('visa_services'))
  return pickNextInRotation(candidates, lastAssignedCounselorId)
}
