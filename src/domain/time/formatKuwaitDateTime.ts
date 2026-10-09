import { KUWAIT_UTC_OFFSET_MS } from './kuwaitTime'

// التصدير كان يكتب الأوقات بـ toLocaleString بلا timeZone، يعني بتوقيت الخادم —
// وعلى فيرسل هذا UTC. فكل ختم وقت بكل ملف إكسل يطلع أقدم بثلاث ساعات، وهو رقم
// معقول تمامًا فما ينتبه له أحد بعدين. الأسوأ إن نسختين من الدالة كانتا موجودتين
// وقد اختلفتا: وحدة تطبع الثواني والثانية لا
//
// نفس أسلوب باقي التطبيق: الكويت بلا توقيت صيفي، ففرق ثابت +3 يكفي ويغنينا عن
// الاعتماد على بيانات المناطق الزمنية بالبيئة
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function kuwaitParts(date: Date) {
  const kuwait = new Date(date.getTime() + KUWAIT_UTC_OFFSET_MS)
  return {
    year: kuwait.getUTCFullYear(),
    month: kuwait.getUTCMonth(),
    day: kuwait.getUTCDate(),
    hour: kuwait.getUTCHours(),
    minute: kuwait.getUTCMinutes(),
    second: kuwait.getUTCSeconds(),
  }
}

const pad = (value: number) => String(value).padStart(2, '0')

// الثواني تُطبع دائمًا. سجل النشاط دفتر مراجعة: حدثان بنفس الدقيقة يحتاجان
// ترتيبًا، وبدون الثواني تضيع المعلومة. وجودها بتصدير الطلاب إسهاب بسيط،
// وغيابها بالسجل نقص حقيقي — فاخترنا الجهة اللي ما تخسر شي
export function formatKuwaitDateTime(date: Date): string {
  const { year, month, day, hour, minute, second } = kuwaitParts(date)
  const meridiem = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${MONTHS[month]} ${day}, ${year}, ${hour12}:${pad(minute)}:${pad(second)} ${meridiem}`
}

// تاريخ بلا وقت — كان toISOString().slice(0,10)، وهذا يقدّم اليوم كامل لأي
// حدث يصير بين منتصف الليل والثالثة فجرًا بالكويت
export function formatKuwaitDate(date: Date): string {
  const { year, month, day } = kuwaitParts(date)
  return `${year}-${pad(month + 1)}-${pad(day)}`
}
