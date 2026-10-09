import { FINISH_STUDENT_STATUSES } from '../../application/useCases/closeVisitAndAdvance'

export type FinishStudentStatusValidationResult =
  { isValid: true } | { isValid: false; reason: string }

// in_session ما مسموح هنا عمداً — المستشار توّه خلّص الجلسة، فما فيه معنى يختار
// "لسا بجلسة" لنفس الزيارة اللي قافلها
export function validateFinishStudentStatus(value: unknown): FinishStudentStatusValidationResult {
  if (typeof value === 'string' && (FINISH_STUDENT_STATUSES as string[]).includes(value)) {
    return { isValid: true }
  }
  return { isValid: false, reason: 'studentStatusInvalid' }
}
