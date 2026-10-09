export type VisitType = 'new' | 'follow_up' | 'visa'
export type VisitStatus = 'next' | 'closed'
export type VisitStudentStatus = 'waiting' | 'in_session' | 'follow_up_needed' | 'closed'

export interface Visit {
  id: string
  type: VisitType
  name: string
  phone: string
  desiredCountry: string | null
  counselorId: string | null
  // اللي طلبه العميل بالكشك (المتابعة). ما يتغير لو المشرف غيّر التعيين
  requestedCounselorId?: string | null
  // متى انعيّن المستشار الحالي. null = غير معيّن
  assignedAt?: Date | null
  linkedVisitId: string | null
  status: VisitStatus
  studentStatus: VisitStudentStatus | null
  pickedUpAt: Date | null
  closedAt: Date | null
  note?: string | null
  followUpDueAt: Date | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}
