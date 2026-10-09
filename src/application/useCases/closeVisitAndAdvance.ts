import type { Visit, VisitStatus, VisitStudentStatus } from '../../domain/entities/visit'
import type { VisitRepository } from '../ports/VisitRepository'
import type { Clock } from '../ports/Clock'

export interface CloseVisitAndAdvanceDeps {
  visitRepository: VisitRepository
  clock: Clock
}

export type CloseVisitAndAdvanceResult = { ok: true; visit: Visit } | { ok: false; reason: string }

// رمز الرفض إذا الزيارة مو بتاعت الكاونسلر اللي طالب يقفلها — نفس القيمة تستخدم بالراوت عشان يرجع 403
export const NOT_YOUR_VISIT_REASON = 'notYourVisit'

// خيارات "كيف راحت الزيارة" وقت الإنهاء. كان فيها "بالانتظار" كمان، وكانت
// تختم closed_at وتخلي status = 'next' بنفس الوقت — يعني نفس الزيارة تُحسب
// "خُدمت اليوم"، وتبان "مفتوحة" بالقمع، وتظل "قيد التنفيذ" بمدة الإنجاز وساعاتها
// تكبر بلا نهاية. ما اختارها أحد ولا مرة بـ285 زيارة، و"يحتاج متابعة" تقول نفس
// المعنى وأوضح (بتاريخ متابعة وتنبيه تأخّر)، فشِلناها
export const FINISH_STUDENT_STATUSES: VisitStudentStatus[] = ['follow_up_needed', 'closed']

// كل إنهاء يقفل الزيارة الحين — ما عاد فيه خيار يختم closed_at ويترك الحالة مفتوحة
function visitStatusFor(_studentStatus: VisitStudentStatus): VisitStatus {
  return 'closed'
}

export async function closeVisitAndAdvance(
  visitId: string,
  studentStatus: VisitStudentStatus,
  counselorId: string,
  deps: CloseVisitAndAdvanceDeps,
  note?: string | null,
  followUpDueAt?: Date | null
): Promise<CloseVisitAndAdvanceResult> {
  // الراوت يتحقق من شكل المدخل؛ هنا نطبّق القاعدة نفسها، عشان أي مسار ثاني
  // (تبويب قديم، سكربت، نداء داخلي) ما يقدر يمرّر حالة ما تصلح للإنهاء
  if (!FINISH_STUDENT_STATUSES.includes(studentStatus)) {
    return { ok: false, reason: 'studentStatusNotAllowedForVisit' }
  }

  const visit = await deps.visitRepository.findById(visitId)
  if (!visit) {
    return { ok: false, reason: 'visitNotStarted' }
  }

  // نتحقق من الملكية أول شي، قبل أي فحص ثاني على حالة الزيارة
  if (visit.counselorId !== counselorId) {
    return { ok: false, reason: NOT_YOUR_VISIT_REASON }
  }

  if (visit.pickedUpAt === null) {
    return { ok: false, reason: 'visitNotStarted' }
  }

  const closedAt = deps.clock.now()
  const status = visitStatusFor(studentStatus)
  await deps.visitRepository.markClosed(
    visitId,
    closedAt,
    status,
    studentStatus,
    note,
    followUpDueAt
  )
  const updated = await deps.visitRepository.findById(visitId)
  return { ok: true, visit: updated as Visit }
}
