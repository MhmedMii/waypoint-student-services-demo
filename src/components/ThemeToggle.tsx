'use client'
import { useEffect, useState } from 'react'
import { readStoredValue, writeStoredValue } from '../lib/safeLocalStorage'

type Mode = 'light' | 'dark'
const STORAGE_KEY = 'app-theme'

function applyMode(mode: Mode) {
  document.documentElement.setAttribute('data-theme', mode)
  writeStoredValue(STORAGE_KEY, mode)
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('light')

  useEffect(() => {
    const saved = readStoredValue(STORAGE_KEY) as Mode | null
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    const initial = saved ?? (prefersDark ? 'dark' : 'light')
    setMode(initial)
    applyMode(initial)
  }, [])

  function handleToggle() {
    const next: Mode = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    applyMode(next)
  }

  return (
    <button
      type="button"
      className="toggle-btn toggle-btn-icon"
      onClick={handleToggle}
      aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span aria-hidden="true">{mode === 'light' ? '☀️' : '🌙'}</span>
    </button>
  )
}
