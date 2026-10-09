import type { VisitRepository } from '../ports/VisitRepository'

export interface LogRowLike {
  action: string
  targetType: 'account' | 'visit' | 'application'
  targetId: string
}

export interface StrandedFlag {
  // العميل قاعد ينتظر ولا أحد معيّن له، الحين. حقيقة نقدر نتأكد منها لأي صف
  // مهما كان تاريخه — بعكس "ليش" اللي ما كانت تُكتب قبل ٢١ سبتمبر
  clientStillUnassigned: boolean
}

// الصفوف القديمة ما تحمل سبب الغياب، لأن الميزة ما كانت موجودة لما انكتبت.
// السبب ما ينعاد بناؤه: ما فيه تاريخ لـlast_seen_at، فيه آخر قيمة بس. اللي
// نقدر نتأكد منه لكل صف هو النتيجة نفسها — هل العميل لسا بدون مستشار
export async function markLogRowsForStrandedClients<T extends LogRowLike>(
  rows: T[],
  visitRepository: VisitRepository
): Promise<Array<T & StrandedFlag>> {
  const visitIds = rows
    .filter((row) => row.targetType === 'visit' && row.action === 'visit_created')
    .map((row) => row.targetId)

  const stranded = await visitRepository.findStrandedVisitIds(Array.from(new Set(visitIds)))
  const strandedSet = new Set(stranded)

  return rows.map((row) => ({ ...row, clientStillUnassigned: strandedSet.has(row.targetId) }))
}
