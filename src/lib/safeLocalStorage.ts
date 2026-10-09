// التخزين المحلي مو مضمون: تصفح خاص بسفاري، متصفح كشك مقفّل، أو مستخدم مانع
// ملفات الموقع. بهالحالات الاستدعاء نفسه يرمي — ما يرجّع null. واللغة والثيم
// كانا ينقرآن بأول useEffect بلا حارس، فالاستثناء يطلع من التركيب ويسقط
// الصفحة كاملة. تذكّر تفضيل ميزة راحة؛ التطبيق نفسه مو ميزة راحة
//
// نفس الحماية كانت موجودة بـ useTablePaging وحده — نسخة ثالثة من try/catch
// معناها ثلاثة أماكن تنتبه لنفس الشي، فجمعناها هنا
export function readStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ما نقدر نتذكّر الاختيار — والصفحة تكمل شغلها عادي بالافتراضي
  }
}
