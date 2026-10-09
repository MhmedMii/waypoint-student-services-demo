import { formatDurationHMS } from '../../domain/time/formatDurationHMS'
import type { Dictionary } from '../../i18n/translations'

export type TranslateFn = <Section extends keyof Dictionary>(
  section: Section,
  key: keyof Dictionary[Section]
) => string

export interface HandlingBadge {
  key: 'instant' | 'leftOpen'
  text: string
}

export interface HandlingStatsLike {
  instantCloseCount: number
  leftOpenCount: number
}

export function formatShortDuration(ms: number, language: 'en' | 'ar'): string {
  return formatDurationHMS(Math.floor(ms / 1000), language)
}

// يُستخدم بلوحة الـ KPI ولوحة الإشراف الحيّة، عشان مايتكرر نفس منطق العرض —
// كلتاهما تعرض avgHandlingMs المستنتج من نفس computeHandlingStats. الوسم
// يعرض العدد بس — رقم "متوسط" لمجموعة استُثنيت أصلًا من الحساب مضلّل
export function handlingBadges(c: HandlingStatsLike, t: TranslateFn): HandlingBadge[] {
  const badges: HandlingBadge[] = []
  if (c.instantCloseCount > 0) {
    badges.push({
      key: 'instant',
      text: t('admin', 'instantCloseBadge').replace('{count}', String(c.instantCloseCount)),
    })
  }
  if (c.leftOpenCount > 0) {
    badges.push({
      key: 'leftOpen',
      text: t('admin', 'leftOpenBadge').replace('{count}', String(c.leftOpenCount)),
    })
  }
  return badges
}
