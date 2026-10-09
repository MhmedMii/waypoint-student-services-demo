import type { Visit, VisitType, VisitStatus, VisitStudentStatus } from '../../domain/entities/visit'

export interface CreateVisitInput {
  type: VisitType
  name: string
  phone: string
  desiredCountry: string | null
  counselorId: string | null
  // المتابعة بس: المستشار اللي اختاره العميل. إلزامي عشان ما ينساه أحد يضيف مسار جديد
  requestedCounselorId: string | null
  linkedVisitId: string | null
  createdBy: string | null
}

export interface CounselorHandlingStatsToday {
  servedToday: number
  avgHandlingMs: number | null
}

export interface VisitRepository {
  create(input: CreateVisitInput): Promise<Visit>
  findById(id: string): Promise<Visit | null>
  findMostRecentByPhone(phone: string): Promise<Visit | null>
  findMostRecentNewVisitByPhone(phone: string): Promise<Visit | null>
  findAssignedQueueForCounselor(counselorId: string): Promise<Visit[]>
  findInProgressForCounselor(counselorId: string): Promise<Visit | null>
  findAllForCounselor(counselorId: string): Promise<Visit[]>
  updateCounselor(visitId: string, counselorId: string | null): Promise<void>
  markPickedUp(visitId: string, pickedUpAt: Date): Promise<void>
  markClosed(
    visitId: string,
    closedAt: Date,
    status: VisitStatus,
    studentStatus: VisitStudentStatus,
    note?: string | null,
    followUpDueAt?: Date | null
  ): Promise<void>
  setStudentStatus(
    visitId: string,
    studentStatus: VisitStudentStatus,
    followUpDueAt: Date | null
  ): Promise<void>
  // بحث بكل الأرشيف، خارج أي نطاق تواريخ — "وين زيارة هذا العميل القديمة"
  findAllMatchingName(normalizedTerm: string): Promise<Visit[]>
  // دفعة وحدة لكل الأرقام: التصدير كان ينادي findAllByPhone لكل عميل على حدة
  findAllByPhones(phones: string[]): Promise<Visit[]>
  countAll(): Promise<number>
  // "أُغلقت اليوم" تعني closed_at داخل اليوم — مو created_at. شاشة المستشار
  // كانت تحسبها بـclosed_at وشاشة الإشراف بـcreated_at، فزيارة انفتحت أمس
  // وانقفلت اليوم تظهر بوحدة وتغيب عن الثانية
  findClosedInRange(fromInclusive: Date, toExclusive: Date): Promise<Visit[]>
  findAllInRange(fromInclusive: Date, toExclusive: Date): Promise<Visit[]>
  findAllByType(type: VisitType): Promise<Visit[]>
  findAllByPhone(phone: string): Promise<Visit[]>
  findAllByStudentStatus(studentStatus: VisitStudentStatus): Promise<Visit[]>
  // "العميل لسا بدون مستشار" — الحقيقة الوحيدة اللي نقدر نتأكد منها لصف قديم
  // بالسجل. السبب ما ينعاد بناؤه لأن ما فيه تاريخ لآخر ظهور، فيه آخر قيمة بس
  findStrandedVisitIds(visitIds: string[]): Promise<string[]>
  deleteVisit(visitId: string): Promise<void>
}
