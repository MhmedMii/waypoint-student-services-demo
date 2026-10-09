export type DateQueryParamValidationResult =
  { isValid: true; date: Date } | { isValid: false; reason: string }

// نتأكد إن قيمة تاريخ جاية من الـ query string صالحة قبل لا نستخدمها — لو ماكو قيمة نرجع التاريخ الافتراضي
export function validateDateQueryParam(
  rawValue: string | null,
  fallback: Date
): DateQueryParamValidationResult {
  if (rawValue === null) return { isValid: true, date: fallback }

  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) {
    return { isValid: false, reason: 'invalidDateValue' }
  }
  return { isValid: true, date: parsed }
}
