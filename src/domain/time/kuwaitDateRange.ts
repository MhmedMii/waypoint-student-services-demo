import { KUWAIT_UTC_OFFSET_MS } from './kuwaitTime'

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// بداية اليوم بتوقيت الكويت (12 منتصف الليل بالكويت) كلحظة UTC حقيقية —
// null لو القيمة مو تاريخ صالح (مثلاً المستخدم مسح خانة التاريخ)
export function kuwaitDayStartFromInput(dateInput: string): Date | null {
  if (!DATE_INPUT_PATTERN.test(dateInput)) return null
  const [year, month, day] = dateInput.split('-').map(Number)
  const utcMidnight = new Date(Date.UTC(year, month - 1, day))
  // Date.UTC يقلب 2026-02-31 لـ 3 مارس بصمت — نرفض التواريخ اللي ما تطابق نفسها
  if (utcMidnight.toISOString().slice(0, 10) !== dateInput) return null
  return new Date(utcMidnight.getTime() - KUWAIT_UTC_OFFSET_MS)
}

// النطاق اللي يشوفه المستخدم (من/إلى، شاملين) → حدود السيرفر: من بداية يوم "من"
// بالكويت لين بداية اليوم اللي بعد "إلى" (حد أعلى غير شامل)، كلها كلحظات UTC دقيقة
export function kuwaitRangeQuery(range: {
  from: string
  to: string
}): { from: string; to: string } | null {
  const fromStart = kuwaitDayStartFromInput(range.from)
  const toStart = kuwaitDayStartFromInput(range.to)
  if (!fromStart || !toStart) return null
  return {
    from: fromStart.toISOString(),
    to: new Date(toStart.getTime() + DAY_MS).toISOString(),
  }
}
