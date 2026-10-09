import { normalizeSearchText } from './normalizeSearchText'

// بحث محلي لصفحات التأشيرات والاختبارات: الصفوف كلها محمّلة أصلاً (ما فيها حد
// تواريخ)، فنفلتر بالمتصفح. ما نحتاج رقم كامل هنا عكس صفحة الزيارات، لأن الرقم
// موجود بالصفحة نفسها ومو مطلوب نطابقه مشفّرًا بقاعدة البيانات
export function matchesClientSearch(
  fields: readonly (string | null | undefined)[],
  term: string
): boolean {
  const needle = normalizeSearchText(term)
  if (!needle) return true
  return fields.some((field) => field && normalizeSearchText(field).includes(needle))
}
