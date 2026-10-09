'use client'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'
import { Nav } from './Nav'
import { HeartbeatPing } from './HeartbeatPing'
import { IdleAutoSignOut } from './IdleAutoSignOut'
import { NotificationsBell } from './NotificationsBell'

// صفحة الاستقبال /intake هي شاشة الكشك اللي يفتحها الباركود — بدون سايدبار
// تنقل، بس نبقّي زري الثيم واللغة زي أي صفحة عامة ثانية
export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  // الجرس بصفحات الأدمن فقط ولدور الأدمن فقط — والمسار نفسه يرفض المستشار،
  // فإخفاء الزر تنظيم للشاشة مو حماية
  const role = (session?.user as { role?: string } | undefined)?.role
  const showsBell = pathname.startsWith('/admin') && (role === 'admin' || role === 'super_admin')

  if (pathname === '/intake') {
    return (
      <>
        {status === 'authenticated' && <HeartbeatPing />}
        {status === 'authenticated' && <IdleAutoSignOut />}
        <div className="toggle-bar">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        {children}
      </>
    )
  }

  // ما فيه سايدبار قبل تسجيل الدخول (صفحات /login وغيرها) — فما نلف
  // المحتوى بـ app-content اللي مبني أصلاً يفسح مساحة للسايدبار
  if (status !== 'authenticated') {
    return (
      <>
        <div className="toggle-bar">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        {children}
      </>
    )
  }

  return (
    <>
      <HeartbeatPing />
      <IdleAutoSignOut />
      <Nav />
      {showsBell && (
        <div className="admin-bell-bar">
          <NotificationsBell />
        </div>
      )}
      {/* نتمركز بفلكس داخل المساحة المتبقية بعد السايدبار — أدق وأثبت
          من حسابات vw اللي تتأثر بعرض شريط التمرير */}
      <div className="app-content">{children}</div>
    </>
  )
}
