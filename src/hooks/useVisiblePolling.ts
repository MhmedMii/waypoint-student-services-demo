'use client'
import { useEffect, useRef } from 'react'

// يشغّل الكولباك فورًا عند التركيب — حتى لو التبويب مخفي — وبعدين كل
// intervalMs مع تجاهل أي تكة والتبويب مخفي (تبويب ثاني، نافذة مصغّرة)،
// ويحدّث فورًا لما يرجع ظاهر. يمنع طلبات تضرب السيرفر كل ثانية وما أحد شايف
// نتيجتها، بدون ما نخاطر بصفحة تفتح بتبويب خلفي فما تحمّل بياناتها أبدًا
export function useVisiblePolling(callback: () => void, intervalMs: number) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    function fire() {
      if (!document.hidden) callbackRef.current()
    }

    // أول تحميل غير مشروط: لو اشترطناه بالظهور، صفحة تُفتح بتبويب بالخلفية
    // تظل عالقة على "جارٍ التحميل" لين ينتبه لها أحد
    callbackRef.current()
    const interval = setInterval(fire, intervalMs)
    document.addEventListener('visibilitychange', fire)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', fire)
    }
  }, [intervalMs])
}
