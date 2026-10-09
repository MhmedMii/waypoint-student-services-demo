'use client'
import { useEffect, useRef, useState } from 'react'

// الجدول العريض يسكرول أفقياً، والشريط الأصلي يكون تحت آخر صف — بجدول طويل لازم
// تنزل للنهاية عشان تمسكه. نضيف شريط ثاني فوق الجدول ونربطهم ببعض (أي واحد
// يتحرك يحرك الثاني). يظهر بس لما الجدول فعلاً أعرض من الشاشة.
export function TopScrollWrap({ children }: { children: React.ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    function measure() {
      if (!body) return
      setContentWidth(body.scrollWidth)
      setIsOverflowing(body.scrollWidth > body.clientWidth + 1)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    if (body.firstElementChild) observer.observe(body.firstElementChild)
    return () => observer.disconnect()
  }, [children])

  // ما نحرك الشريط الثاني إلا لو موضعه مختلف — عشان الحدث اللي يطلقه التحريك
  // البرمجي يلقى الموضعين متساويين ويوقف، بدون حلقة
  function sync(from: HTMLDivElement | null, to: HTMLDivElement | null) {
    if (!from || !to || to.scrollLeft === from.scrollLeft) return
    to.scrollLeft = from.scrollLeft
  }

  return (
    <>
      <div
        className="top-scroll"
        ref={topRef}
        hidden={!isOverflowing}
        aria-hidden="true"
        onScroll={() => sync(topRef.current, bodyRef.current)}
      >
        <div className="top-scroll-inner" style={{ width: contentWidth }} />
      </div>
      <div
        className="table-wrap"
        ref={bodyRef}
        onScroll={() => sync(bodyRef.current, topRef.current)}
      >
        {children}
      </div>
    </>
  )
}
