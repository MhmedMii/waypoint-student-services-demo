import type { ApplicationStatus } from '../entities/application'

const LEGAL_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending: ['under_review'],
  under_review: ['documents_requested', 'submitted_to_source'],
  documents_requested: ['under_review', 'submitted_to_source'],
  submitted_to_source: ['documents_requested', 'approved', 'rejected'],
  approved: [],
  rejected: [],
}

// يحدد أي انتقالات حالة الطلب مسموحة — يمنع القفز فوق خطوات المراجعة (مثلاً pending مباشرة إلى approved)
export function canTransitionApplicationStatus(
  from: ApplicationStatus,
  to: ApplicationStatus
): boolean {
  return LEGAL_TRANSITIONS[from].includes(to)
}
