'use client'
import { useEffect, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoTile } from './LogoTile'
import { useLanguage } from '../i18n/LanguageContext'
import { localizedName } from '../i18n/localizedName'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'

type NavLinkKey =
  | 'intake'
  | 'counselor'
  | 'myStudents'
  | 'dashboard'
  | 'accounts'
  | 'visits'
  | 'activity'
  | 'onlineNow'
  | 'onlineHistory'
  | 'supervision'
  | 'visas'
  | 'exams'
type NavLink = { href: string; key: NavLinkKey; children?: NavLink[] }

const ONLINE_NOW_WITH_CHILDREN: NavLink = {
  href: '/admin/online-now',
  key: 'onlineNow',
  children: [
    { href: '/admin/online-history', key: 'onlineHistory' },
    { href: '/admin/supervision', key: 'supervision' },
  ],
}

const LINKS_BY_ROLE: Record<string, NavLink[]> = {
  counselor: [
    { href: '/counselor', key: 'counselor' },
    { href: '/counselor/students', key: 'myStudents' },
  ],
  admin: [
    { href: '/admin', key: 'dashboard' },
    { href: '/admin/visits', key: 'visits' },
    { href: '/admin/activity', key: 'activity' },
    ONLINE_NOW_WITH_CHILDREN,
  ],
  super_admin: [
    { href: '/admin', key: 'dashboard' },
    { href: '/admin/visits', key: 'visits' },
    { href: '/admin/accounts', key: 'accounts' },
    { href: '/admin/activity', key: 'activity' },
    ONLINE_NOW_WITH_CHILDREN,
    { href: '/visas', key: 'visas' },
    { href: '/exams', key: 'exams' },
  ],
}

function ProfileName({
  name,
  nameAr,
  role,
}: {
  name: string
  nameAr: string | null
  role: string
}) {
  const { update } = useSession()
  const { t, language } = useLanguage()
  const [isEditing, setIsEditing] = useState(false)
  const [nameInput, setNameInput] = useState(name)
  const [saving, setSaving] = useState(false)
  const shownName = localizedName(name, nameAr, language)

  if (role !== 'super_admin') {
    return <span className="name">{shownName}</span>
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        className="name-edit-trigger"
        onClick={() => {
          setNameInput(name)
          setIsEditing(true)
        }}
      >
        <span className="name">{shownName}</span>{' '}
        <span className="edit-hint">{t('nav', 'editName')}</span>
      </button>
    )
  }

  async function handleSave() {
    const trimmed = nameInput.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const result = await response.json()
      if (result.ok) {
        await update({ name: trimmed })
        setIsEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="name-edit-form">
      <input
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
        }}
        autoFocus
      />
      <div className="name-edit-actions">
        <button type="button" onClick={handleSave} disabled={saving}>
          {t('accounts', 'save')}
        </button>
        <button type="button" onClick={() => setIsEditing(false)}>
          {t('accounts', 'cancel')}
        </button>
      </div>
    </div>
  )
}

export function Nav() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { t } = useLanguage()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // نسكر السايدبار تلقائي كل ما ينتقل لصفحة جديدة بالموبايل
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Escape يسكّر القائمة ويرجّع التركيز لـ ☰ — بدون الرجعة، التركيز يضيع
  // داخل قائمة صارت مخفية ولوحة المفاتيح تبدأ من أول الصفحة
  useEffect(() => {
    if (!isMobileOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsMobileOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isMobileOpen])

  if (status !== 'authenticated') return null

  const user = session!.user
  const role: string = user?.role ?? ''
  const scopes: string[] = user?.scopes ?? []
  const links =
    role === 'counselor'
      ? [
          ...(LINKS_BY_ROLE.counselor ?? []),
          ...(scopes.includes('visa_services') ? [{ href: '/visas', key: 'visas' as const }] : []),
          ...(scopes.includes('exam_services') ? [{ href: '/exams', key: 'exams' as const }] : []),
        ]
      : (LINKS_BY_ROLE[role] ?? [])

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="sidebar-toggle-btn"
        aria-label={t('nav', 'menu')}
        aria-expanded={isMobileOpen}
        aria-controls="app-sidebar"
        onClick={() => setIsMobileOpen((open) => !open)}
      >
        ☰
      </button>
      {isMobileOpen && <div className="sidebar-backdrop" onClick={() => setIsMobileOpen(false)} />}
      <aside id="app-sidebar" className={`app-sidebar ${isMobileOpen ? 'open' : ''}`}>
        <LogoTile width={120} className="app-sidebar-brand" />
        <div className="app-sidebar-toggles">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <nav className="app-sidebar-nav">
          {links.map((link) => (
            <div className="app-sidebar-nav-group" key={link.href}>
              <Link href={link.href} className={pathname === link.href ? 'active' : ''}>
                {t('nav', link.key)}
              </Link>
              {link.children && (
                <div className="app-sidebar-nav-sub">
                  {link.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={pathname === child.href ? 'active' : ''}
                    >
                      {t('nav', child.key)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="app-sidebar-profile">
          <ProfileName name={user?.name ?? ''} nameAr={user?.nameAr ?? null} role={role} />
          <span className="role">{t('nav', role as 'counselor' | 'admin' | 'super_admin')}</span>
        </div>
        <button
          type="button"
          className="app-sidebar-signout"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          {t('nav', 'signOut')}
        </button>
      </aside>
    </>
  )
}
