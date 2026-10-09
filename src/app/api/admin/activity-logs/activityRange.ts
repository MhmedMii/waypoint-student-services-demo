import { startOfKuwaitDay } from '../../../../domain/time/kuwaitTime'

// قاعدة واحدة للفترة يستخدمها مساري القائمة والتصدير — عشان الشاشة والملف ما
// يختلفون وين يبدأ "اليوم". قبل، التصدير كان يتجاهل الفترة كلها
const DAY_MS = 24 * 60 * 60 * 1000

// null = بدون حد (أي تاريخ)، أو قيمة ما نفهمها — نفس سلوك المسار من قبل
function rangeDays(daysParam: string | null): number | null {
  if (!daysParam || daysParam === 'all') return null
  const days = Number(daysParam)
  if (!Number.isFinite(days) || days <= 0) return null
  return days
}

export function activityRangeStart(daysParam: string | null, now: Date): Date | null {
  const days = rangeDays(daysParam)
  if (days === null) return null
  // اليوم يبدأ منتصف ليل الكويت، مو منتصف ليل ساعة السيرفر — بـ Vercel هذي UTC،
  // يعني ٣ الفجر عندنا، و"اليوم" كان يطيّح أحداث من ١٢ لـ ٣. الكويت بلا توقيت
  // صيفي، فطرح أيام كاملة من منتصف الليل يعطي منتصف ليل كويتي برضه
  return new Date(startOfKuwaitDay(now).getTime() - (days - 1) * DAY_MS)
}

// الجزء اللي يسمّي الفترة باسم الملف — الملف يقول وش فيه بدون ما أحد يفتحه
export function activityRangeFileLabel(daysParam: string | null): string {
  const days = rangeDays(daysParam)
  if (days === null) return 'all-time'
  if (days === 1) return 'today'
  return `last-${days}-days`
}
