'use client'
import { useEffect } from 'react'
import { HEARTBEAT_INTERVAL_MS } from '../domain/time/presenceTiming'

// نسوي نبضة أول ما الصفحة تفتح، وبعدين كل 30 ثانية طول ما المستخدم مسجل دخول —
// عشان لوحة "أونلاين الحين" بالأدمن تعرف مين متصل فعلاً
export function HeartbeatPing() {
  useEffect(() => {
    function ping() {
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {})
    }
    ping()
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return null
}
