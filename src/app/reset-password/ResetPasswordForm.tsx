'use client'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLanguage } from '../../i18n/LanguageContext'
import { translateErrorCode } from '../../i18n/translateErrorCode'

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t, language } = useLanguage()
  const token = searchParams.get('token') ?? ''
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    })
    const result = await response.json()
    if (!result.ok) {
      setError(translateErrorCode(language, result.reason) ?? t('errors', 'unknownError'))
      return
    }
    router.push('/login')
  }

  return (
    <form onSubmit={handleSubmit} className="login-card">
      <label htmlFor="newPassword">{t('resetPassword', 'newPassword')}</label>
      <input
        id="newPassword"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
      />
      {error && (
        <p role="alert" className="err">
          {error}
        </p>
      )}
      <button type="submit" className="btn-orange">
        {t('resetPassword', 'submit')}
      </button>
    </form>
  )
}
