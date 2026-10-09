export const KUWAIT_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

// للعرض بالمتصفح فقط: toLocaleString بلا timeZone يرسم بساعة جهاز القارئ، مو
// بساعة الكويت. موظف يفتح الشاشة من سفر يشوف أوقاتًا غير اللي يشوفها زميله
export const KUWAIT_TIME_ZONE = 'Asia/Kuwait'

// نفس فرق +3 المستخدم بـ isCounselorVisibleNow.ts — بس هنا نرجّع بداية اليوم
// كتاريخ فعلي نقارن به بالـ SQL، مو مجرد دقائق منذ منتصف الليل
export function startOfKuwaitDay(now: Date): Date {
  const kuwaitNow = new Date(now.getTime() + KUWAIT_UTC_OFFSET_MS)
  const kuwaitMidnightUtcMs = Date.UTC(
    kuwaitNow.getUTCFullYear(),
    kuwaitNow.getUTCMonth(),
    kuwaitNow.getUTCDate()
  )
  return new Date(kuwaitMidnightUtcMs - KUWAIT_UTC_OFFSET_MS)
}
const DAY_MS = 24 * 60 * 60 * 1000

// عدد أيام التقويم الكويتي بين لحظتين — مو الفرق بالمللي ثانية مقسومًا على يوم.
// الفرق بينهما هو البق: آخر ظهور أمس ١١ ليلاً والآن العاشرة صباحًا = ١١ ساعة،
// فالقسمة تعطي صفر يعني "اليوم"، بينما التقويم يقول إنه أمس. صفحة الحسابات
// كانت تقول "آخر ظهور: اليوم" والجرس يقول "ما سجّل دخول اليوم" لنفس الشخص
export function kuwaitCalendarDaysBetween(from: Date, to: Date): number {
  const fromDay = startOfKuwaitDay(from).getTime()
  const toDay = startOfKuwaitDay(to).getTime()
  return Math.round((toDay - fromDay) / DAY_MS)
}

// مفتاح اليوم الكويتي كنص — نحسبه بالتطبيق ونمرره للـSQL، عشان ما يعتمد على
// المنطقة الزمنية المضبوطة بقاعدة البيانات إطلاقًا
export function kuwaitDayKey(date: Date): string {
  const kuwait = new Date(date.getTime() + KUWAIT_UTC_OFFSET_MS)
  const month = String(kuwait.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kuwait.getUTCDate()).padStart(2, '0')
  return `${kuwait.getUTCFullYear()}-${month}-${day}`
}
