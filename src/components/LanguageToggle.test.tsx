import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { LanguageToggle } from './LanguageToggle'

describe('LanguageToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('dir')
    document.documentElement.removeAttribute('lang')
  })

  it('sets dir to rtl and persists ar when clicked from EN', () => {
    render(
      <LanguageProvider>
        <LanguageToggle />
      </LanguageProvider>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    expect(document.documentElement.getAttribute('lang')).toBe('ar')
    expect(document.cookie.match(/app-language=(\w+)/)?.[1]).toBe('ar')
  })

  it('restores ltr when clicked again', () => {
    render(
      <LanguageProvider>
        <LanguageToggle />
      </LanguageProvider>
    )
    const button = screen.getByRole('button')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    expect(document.cookie.match(/app-language=(\w+)/)?.[1]).toBe('en')
  })

  it('restores the persisted language on mount', () => {
    document.cookie = 'app-language=ar; path=/'
    render(
      <LanguageProvider>
        <LanguageToggle />
      </LanguageProvider>
    )
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
  })
})
