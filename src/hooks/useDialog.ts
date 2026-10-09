'use client'
import { useEffect, useId, useRef, type RefObject } from 'react'

// عناصر يوصلها Tab داخل النافذة — نفس اللي المتصفح يمر عليه
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface UseDialogOptions {
  open: boolean
  // نفس اللي يسويه ✕ أو إلغاء بالنافذة — Escape ما يضيف ولا يحذف شي عليه
  onClose: () => void
  // وين يروح التركيز أول ما تفتح. بدونه: النافذة نفسها، فقارئ الشاشة يقرا عنوانها أول.
  // نافذة الحذف تمرر زر الإلغاء: Enter بالعادة ما لازم يحذف سجل عميل
  initialFocusRef?: RefObject<HTMLElement | null>
}

// سلوك واحد لكل النوافذ المنبثقة. قبل، ما وحدة منها تنعلن كنافذة، والتركيز يضل
// على الصفحة اللي وراها — Tab يمشي على الجدول كله قبل ما يوصل أزرار النافذة،
// وEscape ما يسوي شي. خمس مكوّنات بخمس حلول = أربعة منها غلط، فهنا مرة وحدة
export function useDialog({ open, onClose, initialFocusRef }: UseDialogOptions) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    // الزر اللي فتحها — التركيز يرجع له مهما كانت طريقة الإغلاق
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ;(initialFocusRef?.current ?? dialog).focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !dialog.contains(active)
      // الاتجاهين: Shift+Tab من أول عنصر (أو من النافذة نفسها) يروح لآخر عنصر،
      // مو يطيح برّا للصفحة اللي ورا — هذا النص اللي عادةً ينسى
      if (event.shiftKey && (active === first || active === dialog || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // الزر ممكن ينشال مع إغلاق النافذة (مثل صف انحذف) — عندها ما نرجّع لشي مو موجود
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [open, initialFocusRef])

  const dialogProps = {
    ref: dialogRef,
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': titleId,
    tabIndex: -1,
  }
  return { dialogProps, titleId }
}
