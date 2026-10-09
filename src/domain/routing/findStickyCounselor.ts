import type { CounselorCandidate } from '../entities/counselor'

export function findStickyCounselor(
  lastCounselorId: string | null,
  visibleCandidates: CounselorCandidate[]
): CounselorCandidate | null {
  if (!lastCounselorId) return null
  return visibleCandidates.find((c) => c.id === lastCounselorId) ?? null
}
