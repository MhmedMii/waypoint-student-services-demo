import { formatDurationHMS } from './formatDurationHMS'

const SECONDS_PER_HOUR = 3600
const HOURS_PER_DAY = 24

// جمع الأيام بالعربي له 3 صيغ: يوم واحد / يومين / X أيام — نطبّق القاعدة
// المبسّطة الشائعة بواجهات المستخدم (نتجاهل صيغة "يومًا" للجمع الكبير)
function arabicDayLabel(days: number): string {
  if (days === 1) return 'يوم واحد'
  if (days === 2) return 'يومين'
  return `${days} أيام`
}

// مدة منقضية، مو عدّ أيام تقويم ولا أيام دوام: "منذ ٢٦ ساعة" تنعرض "منذ يوم".
// مقصودة كذا — الشاشة تقول كم صار له غايب، لا بأي يوم كان آخر ظهوره
// لآخر ظهور أطول من يوم، نعرضه بصيغة "N يوم" بدل ساعات بثلاث خانات (زي 333h)
// أسهل تُقرأ بسرعة — أقل من يوم نكمل نعرضه بالتفصيل (ساعات/دقايق/ثواني)
export function formatLastSeenAgo(totalSeconds: number, language: 'en' | 'ar' = 'en'): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const totalHours = Math.floor(seconds / SECONDS_PER_HOUR)
  const days = Math.floor(totalHours / HOURS_PER_DAY)

  if (days < 1) {
    const duration = formatDurationHMS(seconds, language)
    return language === 'ar' ? `منذ ${duration}` : `${duration} ago`
  }

  const remainderHours = totalHours % HOURS_PER_DAY
  if (language === 'ar') {
    const dayLabel = arabicDayLabel(days)
    return remainderHours > 0 ? `منذ ${dayLabel} و${remainderHours}س` : `منذ ${dayLabel}`
  }
  const dayLabel = days === 1 ? '1 day' : `${days} days`
  return remainderHours > 0 ? `${dayLabel}, ${remainderHours}h ago` : `${dayLabel} ago`
}
