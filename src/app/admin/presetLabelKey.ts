import type { DateRangePreset } from '../../domain/time/dateRangePresets'

// مشتركة بين لوحة الـKPI وصفحة الزيارات — نفس أسماء النطاقات بالشاشتين
export function presetLabelKey(
  preset: DateRangePreset
): 'rangeWeek' | 'rangeMonth' | 'rangeQuarter' | 'rangeHalfYear' | 'rangeYear' {
  if (preset === 'week') return 'rangeWeek'
  if (preset === 'month') return 'rangeMonth'
  if (preset === 'quarter') return 'rangeQuarter'
  if (preset === 'half_year') return 'rangeHalfYear'
  return 'rangeYear'
}
