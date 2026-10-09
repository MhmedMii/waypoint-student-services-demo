import type { VisitStudentStatus } from '../../domain/entities/visit'
import { validateStudentStatusForVisit } from '../../domain/validation/validateStudentStatusForVisit'
import type { VisitRepository } from '../ports/VisitRepository'
import { NOT_YOUR_VISIT_REASON } from './closeVisitAndAdvance'

export interface SetVisitStudentStatusDeps {
  visitRepository: VisitRepository
}

export type SetVisitStudentStatusResult = { ok: true } | { ok: false; reason: string }

export async function setVisitStudentStatus(
  visitId: string,
  studentStatus: VisitStudentStatus,
  counselorId: string,
  deps: SetVisitStudentStatusDeps,
  followUpDueAt?: Date | null
): Promise<SetVisitStudentStatusResult> {
  const visit = await deps.visitRepository.findById(visitId)
  if (!visit) return { ok: false, reason: 'visitNotFound' }
  if (visit.counselorId !== counselorId) return { ok: false, reason: NOT_YOUR_VISIT_REASON }

  // نمنع أي زوج متناقض (زيارة مقفولة + "بالجلسة") قبل ما يوصل لقاعدة البيانات
  const pairValidation = validateStudentStatusForVisit(visit.status, studentStatus)
  if (!pairValidation.isValid) return { ok: false, reason: pairValidation.reason }

  // "يحتاج متابعة" لازم يجي بتاريخ، مثل شاشة الإنهاء؛ وأي حالة ثانية تمسح التاريخ
  // القديم عشان ما يظهر شارة "متأخر" على طالب ما عاد يحتاج متابعة
  const isFollowUp = studentStatus === 'follow_up_needed'
  if (isFollowUp && !followUpDueAt) return { ok: false, reason: 'followUpDueDateRequired' }

  await deps.visitRepository.setStudentStatus(
    visitId,
    studentStatus,
    isFollowUp ? (followUpDueAt ?? null) : null
  )
  return { ok: true }
}
