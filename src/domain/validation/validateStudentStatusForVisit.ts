import type { VisitStatus, VisitStudentStatus } from '../entities/visit'

export type StudentStatusForVisitResult = { isValid: true } | { isValid: false; reason: string }

// الزيارة المقفولة تتغير حالة طالبها بين "مقفول" و"يحتاج متابعة" بس. "بالانتظار"
// و"بالجلسة" تخص زيارة مفتوحة، والزيارة المفتوحة تتحرك بالبدء والإنهاء بالطابور —
// مو بتعديل يدوي، وإلا نطلع بزيارة مقفولة وحالة طالبها "بالجلسة" (تناقض)
export const EDITABLE_STUDENT_STATUSES_FOR_CLOSED_VISIT: readonly VisitStudentStatus[] = [
  'closed',
  'follow_up_needed',
]

export function editableStudentStatusesFor(
  visitStatus: VisitStatus
): readonly VisitStudentStatus[] {
  return visitStatus === 'closed' ? EDITABLE_STUDENT_STATUSES_FOR_CLOSED_VISIT : []
}

export function validateStudentStatusForVisit(
  visitStatus: VisitStatus,
  studentStatus: VisitStudentStatus
): StudentStatusForVisitResult {
  if (editableStudentStatusesFor(visitStatus).includes(studentStatus)) return { isValid: true }
  return { isValid: false, reason: 'studentStatusNotAllowedForVisit' }
}
