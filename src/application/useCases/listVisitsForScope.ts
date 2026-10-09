import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { Visit, VisitType } from '../../domain/entities/visit'
import type { VisitRepository } from '../ports/VisitRepository'
import type { UserRepository } from '../ports/UserRepository'
import type { Clock } from '../ports/Clock'
import { withCounselorNames, type CounselorNaming } from '../naming/withCounselorNames'

export interface ListVisitsForScopeDeps {
  visitRepository: VisitRepository
  userRepository: UserRepository
  clock: Clock
}

export interface VisitWithCounselor extends Visit, CounselorNaming {}

export type ListVisitsForScopeResult =
  { ok: true; visits: VisitWithCounselor[] } | { ok: false; reason: string }

// نفس منطق listApplicationsForScope — سوبر أدمن يشوف الكل، والمستشار لازم
// يملك نطاق visa_services (نوع الزيارة "visa" هو الوحيد اللي له صفحة مقابلة بالطلبات)
export async function listVisitsForScope(
  actorRole: UserRole,
  actorScopes: SpecializationScope[],
  type: VisitType,
  deps: ListVisitsForScopeDeps
): Promise<ListVisitsForScopeResult> {
  if (actorRole !== 'super_admin') {
    if (actorRole !== 'counselor' || !actorScopes.includes('visa_services')) {
      return { ok: false, reason: 'notAuthorizedScope' }
    }
  }

  const visits = await deps.visitRepository.findAllByType(type)
  return { ok: true, visits: await withCounselorNames(visits, deps.userRepository, deps.clock) }
}
