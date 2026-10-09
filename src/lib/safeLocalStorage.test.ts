import { describe, it, expect, afterEach, vi } from 'vitest'
import { readStoredValue, writeStoredValue } from './safeLocalStorage'

// سفاري بالتصفح الخاص، ومتصفح كشك مقفّل: الاستدعاء يرمي — ما يرجّع null
function breakStorage() {
  // نتجسّس على النسخة نفسها لا على الـ prototype — التجسّس على الـ prototype
  // ما كان يعترض بـ jsdom، فالتست كان ينجح بلا ما يفحص شي
  vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  })
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('safeLocalStorage', () => {
  it('reads a value back when storage works', () => {
    writeStoredValue('k', 'v')
    expect(readStoredValue('k')).toBe('v')
  })

  it('returns null for a key never written', () => {
    expect(readStoredValue('missing')).toBeNull()
  })

  it('returns null instead of throwing when reading is blocked', () => {
    // القيمة موجودة فعلاً — فلو الحظر ما اشتغل، نرجّعها ويطيح التست
    localStorage.setItem('k', 'stored')
    expect(readStoredValue('k')).toBe('stored')

    breakStorage()
    expect(() => readStoredValue('k')).not.toThrow()
    expect(readStoredValue('k')).toBeNull()
  })

  it('swallows a blocked write rather than throwing', () => {
    breakStorage()
    expect(() => writeStoredValue('k', 'v')).not.toThrow()
  })

  // الحصّة ممتلئة: setItem يرمي QuotaExceededError حتى والتخزين شغّال
  it('swallows a full quota too', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    expect(() => writeStoredValue('k', 'v')).not.toThrow()
  })
})
