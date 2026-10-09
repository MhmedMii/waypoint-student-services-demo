'use client'
import { useLanguage } from '../i18n/LanguageContext'

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  function handleToggle() {
    setLanguage(language === 'en' ? 'ar' : 'en')
  }

  return (
    <button
      type="button"
      className="toggle-btn toggle-btn-text"
      onClick={handleToggle}
      aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
    >
      {language === 'en' ? 'EN' : 'AR'}
    </button>
  )
}
