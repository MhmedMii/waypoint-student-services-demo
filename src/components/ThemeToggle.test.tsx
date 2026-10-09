import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('sets data-theme to dark and persists it when clicked from light', () => {
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('app-theme')).toBe('dark')
  })

  it('flips back to light on a second click', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('app-theme')).toBe('light')
  })

  it('restores the persisted theme on mount', () => {
    localStorage.setItem('app-theme', 'dark')
    render(<ThemeToggle />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
// سفاري بالتصفح الخاص وكشك مقفّل: localStorage يرمي بدل ما يرجّع null.
// القراءة كانت أول سطر بالـ useEffect، فالاستثناء يطلع من التركيب ويسقط
// الصفحة كاملة — شاشة بيضاء عشان تفضيل ثيم
describe('ThemeToggle — when storage is blocked', () => {
  function breakStorage() {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
  }

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => vi.restoreAllMocks())

  // نثبّت تفضيل النظام بالتست نفسه بدل ما نعتمد على إعداد البيئة
  function systemPrefers(dark: boolean) {
    window.matchMedia = vi.fn().mockReturnValue({ matches: dark }) as never
  }

  it('still renders rather than taking the page down', () => {
    breakStorage()
    systemPrefers(false)
    expect(() => render(<ThemeToggle />)).not.toThrow()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('falls back to the system preference when it cannot read the stored one', () => {
    breakStorage()
    systemPrefers(false)
    render(<ThemeToggle />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('follows a system preference for dark just the same', () => {
    breakStorage()
    systemPrefers(true)
    render(<ThemeToggle />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('still toggles, it just cannot remember the choice', () => {
    breakStorage()
    systemPrefers(false)
    render(<ThemeToggle />)
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  // متصفح قديم بلا matchMedia كان يرمي بنفس السطر
  it('survives a browser with no matchMedia', () => {
    const original = window.matchMedia
    // @ts-expect-error — نحاكي متصفحًا ما يدعمها إطلاقًا
    delete window.matchMedia
    try {
      expect(() => render(<ThemeToggle />)).not.toThrow()
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    } finally {
      window.matchMedia = original
    }
  })
})
