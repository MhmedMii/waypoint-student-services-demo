import type { VisitStudentStatus } from '../entities/visit'

export type VisitStudentStatusValidationResult =
  { isValid: true } | { isValid: false; reason: string }

const VISIT_STUDENT_STATUSES: VisitStudentStatus[] = [
  'waiting',
  'in_session',
  'follow_up_needed',
  'closed',
]

export function validateVisitStudentStatus(value: unknown): VisitStudentStatusValidationResult {
  if (typeof value === 'string' && (VISIT_STUDENT_STATUSES as string[]).includes(value)) {
    return { isValid: true }
  }
  return { isValid: false, reason: 'visitStudentStatusInvalid' }
}
