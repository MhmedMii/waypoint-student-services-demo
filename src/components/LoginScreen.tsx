'use client'
import { useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../i18n/LanguageContext'
import { LogoTile } from './LogoTile'

// كل دور له صفحته الافتراضية بعد الدخول — المستشار يروح لصفحة المؤقت
// تبعه مباشرة، مو لصفحة الاستقبال اللي هي بس للكشك
const LANDING_PAGE_BY_ROLE: Record<string, string> = {
  counselor: '/counselor',
  admin: '/admin',
  super_admin: '/admin',
}

export function LoginScreen() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // إذا أصلاً مسجل دخول (أو لتوه سجل دخول)، نوجهه لصفحته الافتراضية حسب دوره
    if (status !== 'authenticated') return
    const role = session!.user!.role as string
    router.replace(LANDING_PAGE_BY_ROLE[role] ?? '/intake')
  }, [status, session, router])

  if (status !== 'unauthenticated') return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error === 'RateLimited') {
      setError(t('login', 'rateLimited'))
    } else if (result?.error) {
      setError(t('login', 'invalidCredentials'))
    }
    // النجاح يخلي useSession يتحدث تلقائياً، والـ useEffect فوق يسوي التوجيه
  }

  return (
    <main className="login-screen">
      <LogoTile />
      <form onSubmit={handleSubmit} className="login-card">
        <label htmlFor="email">{t('login', 'email')}</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">{t('login', 'password')}</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="err">
            {error}
          </p>
        )}
        <button type="submit" className="btn-orange">
          {t('login', 'submit')}
        </button>
      </form>
      <div className="login-footer">
        <p className="login-tagline">{t('login', 'tagline')}</p>
        <p className="login-copyright">{t('login', 'copyright')}</p>
      </div>
    </main>
  )
}
