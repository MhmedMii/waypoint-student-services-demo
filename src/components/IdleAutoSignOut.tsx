'use client'
import { useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'

const IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000
const CHECK_INTERVAL_MS = 30 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const

// تسجيل خروج تلقائي وصامت بعد 3 ساعات بدون أي تفاعل (ماوس/كيبورد/لمس/سكرول) —
// يحمي شاشة مفتوحة ومنسية بدون رقيب
export function IdleAutoSignOut() {
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now()
    }

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActive, { passive: true })
    )

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        signOut({ callbackUrl: '/login' })
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive))
      clearInterval(interval)
    }
  }, [])

  return null
}
