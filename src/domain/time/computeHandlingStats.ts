import type { Visit } from '../entities/visit'

const INSTANT_CLOSE_MS = 2 * 60000
const LEFT_OPEN_MS = 8 * 60 * 60000

export interface HandlingStats {
  closedCount: number
  avgHandlingMs: number | null
  instantCloseCount: number
  instantCloseAvgMs: number | null
  leftOpenCount: number
  leftOpenAvgMs: number | null
}

function average(durationsMs: number[]): number | null {
  if (durationsMs.length === 0) return null
  return durationsMs.reduce((sum, ms) => sum + ms, 0) / durationsMs.length
}

// معظم المستشارين ما يضغطون "استلام" لحظة بداية الجلسة — يضغطون استلام وإغلاق
// معًا بعدها، فيصير الفرق بين الوقتين عشوائي (صفر دقيقة أو ساعات) مايعكس شغل
// حقيقي. نستثني الطرفين من المتوسط "النظيف" بس نرجّع متوسط كل مجموعة لحالها
// عشان الواجهة تقدر تعرض رقم دايمًا، حتى لو ما فيه جلسات نظيفة أصلاً
export function computeHandlingStats(visits: Visit[]): HandlingStats {
  const closed = visits.filter((v) => v.pickedUpAt && v.closedAt)
  const clean: number[] = []
  const instant: number[] = []
  const leftOpen: number[] = []
  for (const v of closed) {
    const ms = v.closedAt!.getTime() - v.pickedUpAt!.getTime()
    if (ms < INSTANT_CLOSE_MS) instant.push(ms)
    else if (ms >= LEFT_OPEN_MS) leftOpen.push(ms)
    else clean.push(ms)
  }
  return {
    closedCount: closed.length,
    avgHandlingMs: average(clean),
    instantCloseCount: instant.length,
    instantCloseAvgMs: average(instant),
    leftOpenCount: leftOpen.length,
    leftOpenAvgMs: average(leftOpen),
  }
}
