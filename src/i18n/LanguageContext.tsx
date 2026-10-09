// src/i18n/LanguageContext.tsx
'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { translations, type Language, type Dictionary } from './translations'
import { directionFor, readLanguageCookie, writeLanguageCookie } from './languageCookie'

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: <Section extends keyof Dictionary>(section: Section, key: keyof Dictionary[Section]) => string
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

// نطبّق اللغة على <html> ونخزّنها بكوكي يقرأها السيرفر كمان
function applyLanguage(language: Language) {
  document.documentElement.lang = language
  document.documentElement.dir = directionFor(language)
  writeLanguageCookie(language)
}

export function LanguageProvider({
  children,
  // السيرفر يمرّرها من الكوكي، فالحالة تبدأ صحيحة بدل ما تبدأ إنجليزي
  // وتتصلّح بـuseEffect بعد ما يشوف المستخدم الاتجاه الغلط
  initialLanguage = 'en',
}: {
  children: ReactNode
  initialLanguage?: Language
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  useEffect(() => {
    // الكوكي هو المرجع، والسيرفر رسم الصفحة منه. نصلّح فقط لو اختلفا —
    // صفحة من الكاش، أو تبديل اللغة بتبويب ثاني
    const resolved = readLanguageCookie() ?? initialLanguage
    setLanguageState(resolved)
    // نضمن إن <html> يطابق اللغة المعروضة. السيرفر ضبطها أصلاً، بس بهذا
    // يصير المزوّد صحيحًا لحاله ولا يعتمد على أحد يضبطها له
    document.documentElement.lang = resolved
    document.documentElement.dir = directionFor(resolved)
  }, [initialLanguage])

  function setLanguage(next: Language) {
    setLanguageState(next)
    applyLanguage(next)
  }

  function t<Section extends keyof Dictionary>(
    section: Section,
    key: keyof Dictionary[Section]
  ): string {
    return translations[language][section][key] as string
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider')
  return context
}
