import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageProvider, useLanguage } from './LanguageContext'

function Probe() {
  const { language, setLanguage, t } = useLanguage()
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="word">{t('common', 'loading')}</span>
      <button onClick={() => setLanguage('ar')}>to arabic</button>
    </div>
  )
}

function renderProbe(initialLanguage?: 'en' | 'ar') {
  return render(
    <LanguageProvider initialLanguage={initialLanguage}>
      <Probe />
    </LanguageProvider>
  )
}

// سفاري بالتصفح الخاص وكشك مقفّل: الاستدعاء يرمي — ما يرجّع null
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
  document.documentElement.removeAttribute('dir')
})
afterEach(() => vi.restoreAllMocks())

describe('LanguageProvider', () => {
  it('restores the saved language on mount', () => {
    document.cookie = 'app-language=ar; path=/'
    renderProbe()
    expect(screen.getByTestId('lang').textContent).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
  })
})

// اللغة صارت بكوكي عشان السيرفر يقدر يقرأها قبل الترطيب. يعني تعطّل التخزين
// المحلي ما عاد له أي علاقة باللغة — وهذي خاصية تستاهل تُثبّت
describe('LanguageProvider — when localStorage is blocked', () => {
  it('is unaffected, because the language lives in a cookie now', () => {
    document.cookie = 'app-language=ar; path=/'
    breakStorage()
    expect(() => renderProbe('ar')).not.toThrow()
    expect(screen.getByTestId('lang').textContent).toBe('ar')
  })
})

// البق الأصلي: الحالة تبدأ 'en' ثم يصلّحها useEffect بعد الرسم، فالمستخدم
// العربي يشوف الإنجليزي LTR للحظة بكل تحميل صفحة
describe('LanguageProvider — the direction comes from the server', () => {
  it('starts in the language the server rendered, with no correcting effect', () => {
    renderProbe('ar')
    expect(screen.getByTestId('lang').textContent).toBe('ar')
    expect(screen.getByTestId('word').textContent).toBe('جارٍ التحميل…')
  })

  it('applies the matching direction', () => {
    renderProbe('ar')
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('defaults to English when the server passed nothing', () => {
    renderProbe()
    expect(screen.getByTestId('lang').textContent).toBe('en')
  })

  it('writes the choice to the cookie, so the next request is rendered right', () => {
    renderProbe()
    fireEvent.click(screen.getByText('to arabic'))
    expect(document.cookie).toContain('app-language=ar')
    expect(document.documentElement.dir).toBe('rtl')
  })

  // كوكي أحدث من اللي رسم به السيرفر (صفحة من الكاش، أو تبديل بتبويب ثاني)
  it('follows a cookie that disagrees with what the server rendered', async () => {
    document.cookie = 'app-language=ar; path=/'
    renderProbe('en')
    await waitFor(() => expect(screen.getByTestId('lang').textContent).toBe('ar'))
  })
})
