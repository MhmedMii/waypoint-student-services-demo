import type { SpecializationScope, CounselorCandidate } from '../../domain/entities/counselor'

export interface SpecializationRepository {
  findScopesForCounselor(counselorId: string): Promise<SpecializationScope[]>
  // كل النطاقات لعدة مستشارين باستعلام واحد — صفحة الحسابات تعرضها لكل صف
  findScopesForCounselors(counselorIds: string[]): Promise<Record<string, SpecializationScope[]>>
  findCandidatesForActiveCounselors(): Promise<CounselorCandidate[]>
  // المعطّلون مستثنون من التوزيع أصلاً، فما يوصلون للمرشحين. بس لما يبقى
  // العميل بلا مستشار نحتاج نفرّق: "ما فيه أحد يغطيها" غير "اللي يغطيها
  // حسابه مقفل" — السببان يودّونك لمكانين مختلفين
  countDeactivatedScopeHolders(scope: SpecializationScope): Promise<number>
  setScopes(counselorId: string, scopes: SpecializationScope[]): Promise<void>
  // مكان الدورة لكل نطاق: آخر مستشار استلم عميل من هالنطاق بالذات
  findLastAssignedCounselorForScope(scope: SpecializationScope): Promise<string | null>
  // يختم صف هالنطاق بس — لو ختم كل نطاقات المستشار، عميل UK يحرّك دورة USA
  recordAssignment(counselorId: string, scope: SpecializationScope, assignedAt: Date): Promise<void>
}
