'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  SquaresFour,
  UsersThree,
  UserCircle,
  ClipboardText,
  AirplaneTilt,
  Certificate,
  ClockCounterClockwise,
  ChartBar,
  ArrowCounterClockwise,
  ArrowUpRight,
  Sun,
  Moon,
  List,
  X,
  Plus,
  CaretDown,
  Compass,
  SignOut,
} from '@phosphor-icons/react'
import { Brand } from './ui'
import { useDemo } from './DemoProvider'
import type { DemoRole } from './types'

const LINKS = [
  {
    href: '/admin',
    en: 'Overview',
    ar: 'نظرة عامة',
    icon: SquaresFour,
    group: 'workspace',
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/admin/visits',
    en: 'Student visits',
    ar: 'زيارات الطلاب',
    icon: UsersThree,
    group: 'workspace',
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/counselor',
    en: 'Counselor desk',
    ar: 'مكتب المستشار',
    icon: UserCircle,
    group: 'workspace',
    roles: ['super_admin', 'counselor'],
  },
  {
    href: '/counselor/students',
    en: 'My students',
    ar: 'طلابي',
    icon: ClipboardText,
    group: 'workspace',
    roles: ['super_admin', 'counselor'],
  },
  {
    href: '/visas',
    en: 'Visa applications',
    ar: 'طلبات التأشيرات',
    icon: AirplaneTilt,
    group: 'services',
    roles: ['super_admin', 'admin', 'counselor'],
  },
  {
    href: '/exams',
    en: 'Exam bookings',
    ar: 'حجوزات الاختبارات',
    icon: Certificate,
    group: 'services',
    roles: ['super_admin', 'admin', 'counselor'],
  },
  {
    href: '/admin/supervision',
    en: 'Team overview',
    ar: 'نظرة على الفريق',
    icon: ChartBar,
    group: 'manage',
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/admin/accounts',
    en: 'Accounts',
    ar: 'الحسابات',
    icon: UsersThree,
    group: 'manage',
    roles: ['super_admin'],
  },
  {
    href: '/admin/activity',
    en: 'Activity log',
    ar: 'سجل النشاط',
    icon: ClockCounterClockwise,
    group: 'manage',
    roles: ['super_admin', 'admin'],
  },
]
export function Preferences() {
  const { language, setLanguage, theme, setTheme, tr } = useDemo()
  return (
    <div className="preferences">
      <button
        className="language-button"
        onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
        aria-label={tr('Switch to Arabic', 'التبديل إلى الإنجليزية')}
      >
        {language === 'en' ? 'العربية' : 'English'}
      </button>
      <button
        className="icon-button"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        aria-label={tr(
          theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
          theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'
        )}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </div>
  )
}
export function DemoShell({ children }: { children: ReactNode }) {
  const { tr, role, setRole, reset, data } = useDemo()
  const pathname = usePathname()
  const router = useRouter()
  const [menu, setMenu] = useState(false)
  const [resetting, setResetting] = useState(false)
  const active = LINKS.find((link) => link.href === pathname)
  const waiting = data.visits.filter((v) => v.state === 'waiting').length
  function changeRole(value: DemoRole) {
    setRole(value)
    router.push(value === 'counselor' ? '/counselor' : '/admin')
    setMenu(false)
  }
  function handleReset() {
    reset()
    setResetting(false)
    router.refresh()
  }
  return (
    <div className="demo-app">
      <a className="skip-link" href="#main-content">
        {tr('Skip to content', 'انتقل إلى المحتوى')}
      </a>
      {menu && (
        <button
          className="mobile-backdrop"
          onClick={() => setMenu(false)}
          aria-label={tr('Close navigation', 'إغلاق القائمة')}
        />
      )}
      <aside className={`sidebar ${menu ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-close"
            onClick={() => setMenu(false)}
            aria-label={tr('Close navigation', 'إغلاق القائمة')}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar">W</span>
          <span>
            {tr('Demo workspace', 'مساحة تجريبية')}
            <small>{tr('Education consultancy', 'استشارات تعليمية')}</small>
          </span>
          <CaretDown size={14} />
        </div>
        <nav aria-label={tr('Main navigation', 'القائمة الرئيسية')}>
          {(['workspace', 'services', 'manage'] as const).map((group) => {
            const links = LINKS.filter((link) => link.group === group && link.roles.includes(role))
            if (!links.length) return null
            return (
              <div className="nav-group" key={group}>
                <p className="nav-caption">
                  {group === 'workspace'
                    ? tr('Workspace', 'مساحة العمل')
                    : group === 'services'
                      ? tr('Student services', 'خدمات الطلاب')
                      : tr('Management', 'الإدارة')}
                </p>
                {links.map(({ href, icon: Icon, en, ar }) => (
                  <Link
                    onClick={() => setMenu(false)}
                    key={href}
                    href={href}
                    className={`nav-link ${pathname === href || (pathname === '/' && href === '/admin') ? 'is-active' : ''}`}
                    aria-current={
                      pathname === href || (pathname === '/' && href === '/admin')
                        ? 'page'
                        : undefined
                    }
                  >
                    <Icon size={20} weight={pathname === href ? 'fill' : 'regular'} />
                    <span>{tr(en, ar)}</span>
                    {href === '/admin/visits' && <span className="nav-count">{waiting}</span>}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link className="applicant-link" href="/apply">
            <Compass size={22} />
            <span>
              {tr('Explore the applicant view', 'استكشف واجهة الطالب')}
              <small>{tr('Try a fictional application', 'جرّب طلباً وهمياً')}</small>
            </span>
            <ArrowUpRight size={17} />
          </Link>
          <div className="sidebar-profile">
            <span className="profile-avatar">D</span>
            <span>
              <strong>{tr('Demo workspace', 'مساحة تجريبية')}</strong>
              <small>{tr('All records are fictional', 'جميع السجلات وهمية')}</small>
            </span>
            <Link
              href="/login"
              className="icon-button"
              aria-label={tr('Demo welcome screen', 'شاشة الترحيب')}
            >
              <SignOut size={17} />
            </Link>
          </div>
        </div>
      </aside>
      <div className="app-area">
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(true)}
              aria-label={tr('Open navigation', 'فتح القائمة')}
              aria-expanded={menu}
            >
              <List size={22} />
            </button>
            <span>{tr('Workspace', 'مساحة العمل')}</span>
            <span className="crumb-slash">/</span>
            <strong>{active ? tr(active.en, active.ar) : tr('Overview', 'نظرة عامة')}</strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-indicator">{tr('Interactive demo', 'عرض تفاعلي')}</span>
            <label className="role-selector">
              <span className="sr-only">{tr('Explore as', 'استكشف بصفتك')}</span>
              <select value={role} onChange={(e) => changeRole(e.target.value as DemoRole)}>
                <option value="super_admin">{tr('Owner demo', 'عرض المالك')}</option>
                <option value="admin">{tr('Admin demo', 'عرض المدير')}</option>
                <option value="counselor">{tr('Counselor demo', 'عرض المستشار')}</option>
              </select>
            </label>
            <Preferences />
          </div>
        </header>
        <div className="demo-strip">
          <span>
            {tr(
              'A fictional workspace, ready to explore. Changes stay in this browser.',
              'مساحة وهمية جاهزة للاستكشاف. تبقى التغييرات في هذا المتصفح.'
            )}
          </span>
          <button onClick={() => setResetting(true)}>
            <ArrowCounterClockwise size={14} />
            {tr('Reset demo', 'إعادة ضبط العرض')}
          </button>
        </div>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            waypoint<span> / </span>
            {tr('Student services demo', 'عرض خدمات الطلاب')}
          </span>
          <span>{tr('Fictional people. Real workflows.', 'أشخاص وهميون. إجراءات عملية.')}</span>
        </footer>
      </div>
      {resetting && <ResetDialog onCancel={() => setResetting(false)} onConfirm={handleReset} />}
    </div>
  )
}
function ResetDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { tr } = useDemo()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby="reset-title"
      className="reset-dialog"
      onCancel={onCancel}
    >
      <h2 id="reset-title">{tr('Start fresh?', 'البدء من جديد؟')}</h2>
      <p>
        {tr(
          'Restore the fictional dataset and remove this browser’s demo changes.',
          'استعد البيانات الوهمية واحذف تغييرات العرض في هذا المتصفح.'
        )}
      </p>
      <div className="button-row">
        <button className="button button-secondary" onClick={onCancel} autoFocus>
          {tr('Keep exploring', 'متابعة الاستكشاف')}
        </button>
        <button className="button" onClick={onConfirm}>
          {tr('Reset demo', 'إعادة ضبط العرض')}
        </button>
      </div>
    </dialog>
  )
}
export function RegisterButton() {
  const { tr } = useDemo()
  return (
    <Link href="/intake" className="button">
      <Plus size={17} />
      {tr('Register a visit', 'تسجيل زيارة')}
    </Link>
  )
}
