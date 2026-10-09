// نبضة الحضور لها طرفان لازم يتفقان: المتصفح يرسل كل هالمدة، والسيرفر يزيد
// عداد "أونلاين اليوم" بنفس المقدار. كانا رقمين مكتوبين بملفين، وتعليق يقول
// "لازم يطابق" — تعليق ما يمنع أحد يغيّر واحد وينسى الثاني
export const HEARTBEAT_INTERVAL_SECONDS = 30
export const HEARTBEAT_INTERVAL_MS = HEARTBEAT_INTERVAL_SECONDS * 1000

// نعتبره خرج إذا ضاعت عدة نبضات متتالية، مو نبضة وحدة — تبويب بطيء أو شبكة
// تتعثّر ما تطلّع أحد "أوفلاين" وهو قاعد قدام الشاشة
export const MISSED_HEARTBEATS_BEFORE_OFFLINE = 4
export const ONLINE_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * MISSED_HEARTBEATS_BEFORE_OFFLINE

// تعريف واحد لـ"أونلاين الحين": آخر نبضة خلال المهلة. صفحة الأونلاين وجدول
// الزيارات يسألون نفس السؤال — لو كل واحد حسبه بنفسه، يختلفون على نفس الشخص
export function isOnlineNow(lastSeenAt: Date | null, now: Date): boolean {
  return lastSeenAt !== null && now.getTime() - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS
}
