import type { VisitStudentStatus } from '../entities/visit'

export type FollowUpDueDateValidationResult =
  { isValid: true; date: Date | null } | { isValid: false; reason: string }

// المتطلب بس لو الحالة "يحتاج متابعة" — أي حالة ثانية نتجاهل القيمة المُرسلة
// كليًا (نرجّع null) عشان ما تعلق تاريخ قديم على زيارة انقفلت بحالة مختلفة
export function validateFollowUpDueDate(
  studentStatus: VisitStudentStatus,
  followUpDueAt: unknown
): FollowUpDueDateValidationResult {
  if (studentStatus !== 'follow_up_needed') return { isValid: true, date: null }
  if (typeof followUpDueAt !== 'string' || followUpDueAt.trim() === '') {
    return { isValid: false, reason: 'followUpDueDateRequired' }
  }
  const date = new Date(followUpDueAt)
  if (Number.isNaN(date.getTime())) {
    return { isValid: false, reason: 'followUpDueDateRequired' }
  }
  return { isValid: true, date }
}
