export type ApplicationKind = 'visa' | 'exam'

export type ApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'documents_requested'
  | 'submitted_to_source'
  | 'approved'
  | 'rejected'

// مقبول أو مرفوض = انتهى. أي حالة ثانية لسا شغّالة وتنتظر أحد يشتغل عليها
export function isApplicationOpen(status: ApplicationStatus): boolean {
  return status !== 'approved' && status !== 'rejected'
}

export const VISA_SERVICES = [
  'uk-student',
  'us-f1',
  'malta-student',
  'ireland-student',
  'australia-student',
  'new-zealand-student',
] as const
export type VisaServiceCode = (typeof VISA_SERVICES)[number]

export const EXAM_SERVICES = ['ielts', 'toefl'] as const
export type ExamServiceCode = (typeof EXAM_SERVICES)[number]

export type ServiceCode = VisaServiceCode | ExamServiceCode

export interface Application {
  id: string
  applicationNumber: string
  kind: ApplicationKind
  serviceCode: ServiceCode
  name: string
  phone: string
  email: string | null
  fields: Record<string, string>
  status: ApplicationStatus
  statusNote: string | null
  referenceNumber: string | null
  counselorId: string | null
  paymentUrl: string | null
  acceptedAt: Date | null
  closedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
