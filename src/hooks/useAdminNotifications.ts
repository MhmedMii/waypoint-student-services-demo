'use client'
import { useState } from 'react'
import { useVisiblePolling } from './useVisiblePolling'
import type { AdminNotifications } from '../application/useCases/getAdminNotifications'

export const NOTIFICATIONS_REFRESH_MS = 60_000
export const OPEN_NOTIFICATIONS_EVENT = 'app:open-notifications'

export function openNotificationsPanel() {
  window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT))
}

// كل دقيقة، ومع أول رجعة للتبويب — نفس سلوك بقية الشاشات. الفشل يترك آخر
// قيمة معروفة بدل ما يصفّر العدّادات: "٠ ينتظرون" غلط أخطر من رقم قديم
export function useAdminNotifications(): AdminNotifications | null {
  const [view, setView] = useState<AdminNotifications | null>(null)

  useVisiblePolling(() => {
    void fetch('/api/admin/notifications')
      .then((response) => (response.ok ? response.json() : null))
      .then((next: AdminNotifications | null) => {
        if (next) setView(next)
      })
      .catch(() => {})
  }, NOTIFICATIONS_REFRESH_MS)

  return view
}
