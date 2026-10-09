'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { readStoredValue, writeStoredValue } from '../lib/safeLocalStorage'
import { createDemoData, PEOPLE } from './fixtures'
import { reduceDemo, type DemoAction } from './model'
import type { DemoData, DemoRole } from './types'

export const DEMO_STORAGE_KEY = 'waypoint-fictional-demo-v1'
type Language = 'en' | 'ar'
interface DemoContextValue {
  data: DemoData
  ready: boolean
  role: DemoRole
  language: Language
  theme: 'light' | 'dark'
  now: number
  dispatch: (action: DemoAction) => void
  reset: () => void
  setRole: (role: DemoRole) => void
  setLanguage: (language: Language) => void
  setTheme: (theme: 'light' | 'dark') => void
  tr: (english: string, arabic: string) => string
}
const DemoContext = createContext<DemoContextValue | null>(null)

export function readDemoData(raw: string | null): DemoData | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as DemoData
    const validLists = [data.team, data.visits, data.applications, data.events].every(
      (list) => Array.isArray(list) && list.length <= 1000
    )
    if (data.version !== 1 || !validLists || !Number.isFinite(data.generatedAt)) return null
    const identities = new Set(PEOPLE.map((p) => p.id))
    if (
      !data.team.every(
        (m) =>
          typeof m.id === 'string' &&
          typeof m.name === 'string' &&
          m.email.endsWith('@example.com') &&
          Array.isArray(m.scopes)
      )
    )
      return null
    if (!data.visits.every((v) => identities.has(v.personId) && Number.isFinite(v.createdAt)))
      return null
    if (!data.applications.every((a) => identities.has(a.personId) && Array.isArray(a.documents)))
      return null
    if (Date.now() - data.generatedAt > 86400000) return null
    return data
  } catch {
    return null
  }
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoData>(() => createDemoData())
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<DemoRole>('super_admin')
  const [language, setLanguage] = useState<Language>('en')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const stored = readDemoData(readStoredValue(DEMO_STORAGE_KEY))
    if (stored) setData(stored)
    const savedLanguage = readStoredValue('waypoint-language')
    if (savedLanguage === 'ar') setLanguage('ar')
    const savedTheme = readStoredValue('waypoint-theme')
    setTheme(
      savedTheme === 'dark' ||
        (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light'
    )
    const savedRole = readStoredValue('waypoint-role')
    if (savedRole === 'admin' || savedRole === 'counselor') setRole(savedRole)
    setReady(true)
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    if (ready) writeStoredValue(DEMO_STORAGE_KEY, JSON.stringify(data))
  }, [data, ready])
  useEffect(() => {
    if (!ready) return
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.dataset.theme = theme
    writeStoredValue('waypoint-language', language)
    writeStoredValue('waypoint-theme', theme)
    writeStoredValue('waypoint-role', role)
  }, [language, theme, role, ready])
  const dispatch = (action: DemoAction) => setData((current) => reduceDemo(current, action))
  const reset = () => {
    setData(createDemoData())
    setNow(Date.now())
  }
  return (
    <DemoContext.Provider
      value={{
        data,
        ready,
        role,
        language,
        theme,
        now,
        dispatch,
        reset,
        setRole,
        setLanguage,
        setTheme,
        tr: (en, ar) => (language === 'ar' ? ar : en),
      }}
    >
      {children}
    </DemoContext.Provider>
  )
}
export function useDemo() {
  const value = useContext(DemoContext)
  if (!value) throw new Error('The demo provider is required')
  return value
}
