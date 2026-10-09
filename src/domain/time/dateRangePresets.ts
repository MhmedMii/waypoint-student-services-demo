import { KUWAIT_UTC_OFFSET_MS } from './kuwaitTime'

export type DateRangePreset = 'week' | 'month' | 'quarter' | 'half_year' | 'year'

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  'week',
  'month',
  'quarter',
  'half_year',
  'year',
]

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// كل النطاقات (شهري، ربع سنوي، نصف سنوي، سنوي) تبدأ من أول اليوم المحسوب لين اليوم الحالي.
// "اليوم" هنا بتوقيت الكويت مو UTC — بين 12 و3 الفجر بالكويت تاريخ UTC يظل أمس
export function computeDateRangeForPreset(
  preset: DateRangePreset,
  currentTime: Date
): { from: string; to: string } {
  const now = new Date(currentTime.getTime() + KUWAIT_UTC_OFFSET_MS)
  const to = toDateInputValue(now)

  if (preset === 'week') {
    const from = new Date(now.getTime() - 7 * 86400000)
    return { from: toDateInputValue(from), to }
  }

  if (preset === 'month') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    return { from: toDateInputValue(from), to }
  }

  if (preset === 'quarter') {
    const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3
    const from = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1))
    return { from: toDateInputValue(from), to }
  }

  if (preset === 'half_year') {
    const halfStartMonth = now.getUTCMonth() < 6 ? 0 : 6
    const from = new Date(Date.UTC(now.getUTCFullYear(), halfStartMonth, 1))
    return { from: toDateInputValue(from), to }
  }

  const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  return { from: toDateInputValue(from), to }
}
