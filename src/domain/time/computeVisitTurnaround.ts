import type { VisitStatus } from '../entities/visit'

const WITHIN_HOURS = 24

export type VisitTurnaround =
  | { status: 'within24h'; hours: number }
  | { status: 'over24h'; hours: number }
  | { status: 'in_progress'; hours: number }

interface TurnaroundInput {
  status: VisitStatus
  createdAt: Date
  closedAt: Date | null
}

// createdAt هو وقت التقديم (استقبال العميل)، مو وقت استلام المستشار له —
// نقيس كم انتظر العميل بالكامل، مو وقت شغل المستشار عليه لحاله (ذاك محسوب
// بمكان ثاني بـ computeHandlingStats). أقل من 24 ساعة ضمن الوقت، 24 وفوق متأخر
export function computeVisitTurnaround(visit: TurnaroundInput, now: Date): VisitTurnaround {
  if (visit.status === 'closed' && visit.closedAt) {
    const hours = (visit.closedAt.getTime() - visit.createdAt.getTime()) / 3600000
    return { status: hours < WITHIN_HOURS ? 'within24h' : 'over24h', hours }
  }
  const hours = (now.getTime() - visit.createdAt.getTime()) / 3600000
  return { status: 'in_progress', hours }
}
