import type { SpecializationScope } from '../../domain/entities/counselor'
import { COUNTRY_LABEL_KEYS, isKnownCountryScope } from '../../i18n/countryLabels'
import type { Dictionary } from '../../i18n/translations'
import { kuwaitCalendarDaysBetween } from '../../domain/time/kuwaitTime'

type TranslateFn = <Section extends keyof Dictionary>(
  section: Section,
  key: keyof Dictionary[Section]
) => string

const DAY_MS = 24 * 60 * 60 * 1000

// نطاقات الخدمات (تأشيرات/اختبارات) مو دول، فما تنترجم من قائمة الدول
export function scopeLabel(scope: SpecializationScope, t: TranslateFn): string {
  if (scope === 'visa_services' || scope === 'exam_services') return t('scopes', scope)
  return isKnownCountryScope(scope) ? t('countries', COUNTRY_LABEL_KEYS[scope]) : scope
}

// نقبل undefined: لو رجع صف قديم بدون الحقل (نسخة مخزّنة وقت النشر مثلاً)
// نعرض "بلا تخصص" بدل ما تنهار الصفحة كلها
export function scopeSummary(
  scopes: readonly SpecializationScope[] | undefined,
  t: TranslateFn
): { text: string; isNone: boolean } {
  if (!scopes || scopes.length === 0) return { text: t('accounts', 'noScopes'), isNone: true }
  if (scopes.length === 1) return { text: t('accounts', 'scopeCountOne'), isNone: false }
  return {
    text: t('accounts', 'scopeCount').replace('{count}', String(scopes.length)),
    isNone: false,
  }
}

export interface LastSeenDisplay {
  text: string
  isStale: boolean
}

const STALE_AFTER_DAYS = 7

// نعد الأيام من فرق التواريخ نفسه — ما نحتاج دقة حدود اليوم هنا، المقصود
// "متى آخر مرة دخل" مو تقرير يومي
export function lastSeenDisplay(
  lastSeenAt: string | Date | null,
  now: Date,
  t: TranslateFn
): LastSeenDisplay {
  if (!lastSeenAt) return { text: t('accounts', 'lastSeenNever'), isStale: true }
  const seen = new Date(lastSeenAt)
  if (Number.isNaN(seen.getTime())) return { text: t('accounts', 'lastSeenNever'), isStale: true }

  // أيام تقويم عن قصد، مو أيام دوام: السؤال هنا "متى آخر مرة فتح التطبيق"،
  // وغيابه بعطلة نهاية الأسبوع غياب برضه. أيام الدوام تجاوب سؤالًا ثانيًا —
  // "هل التوزيع لسه يعطيه عملاء" — وهذا شغل ABSENT_AFTER_WORKING_DAYS
  // كان يقسم فرق المللي ثانية على يوم: آخر ظهور أمس ١١ ليلاً والآن العاشرة
  // صباحًا = ١١ ساعة، فيطلع صفر يعني "اليوم" — بينما hasSignedInToday يقول
  // إنه ما دخل اليوم. نفس الشخص، شاشتان، جوابان متناقضان
  const days = Math.max(0, kuwaitCalendarDaysBetween(seen, now))
  if (days === 0) return { text: t('accounts', 'lastSeenToday'), isStale: false }
  if (days === 1) return { text: t('accounts', 'lastSeenYesterday'), isStale: false }
  return {
    text: t('accounts', 'lastSeenDaysAgo').replace('{days}', String(days)),
    isStale: days >= STALE_AFTER_DAYS,
  }
}

// الحسابات المعطّلة تنزل تحت وتبهت — الفريق الشغّال يقرأ ككتلة وحدة بدل ما
// ينقطع بأسماء معطّلة بالترتيب الأبجدي
export function activeFirst<T extends { active: boolean }>(users: readonly T[]): T[] {
  return [...users].sort((a, b) => Number(b.active) - Number(a.active))
}
